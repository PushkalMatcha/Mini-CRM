from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from fastapi.responses import StreamingResponse
import io
import csv
import pandas as pd
import logging
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from models import supabase
from schemas import CustomerCreate, CustomerUpdate, CustomerResponse
from dependencies import verify_session, RateLimiter

rfm_limiter = RateLimiter(requests_limit=2, window_seconds=60)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/customers", tags=["Customers"])

# Static reference date matching the simulated data workspace timeline in 2026
CURRENT_DATE = datetime(2026, 6, 12, tzinfo=timezone.utc)

@router.get("/export", status_code=status.HTTP_200_OK)
async def export_customers_csv():
    """
    Exports the entire customer database as a CSV stream.
    """
    try:
        # Fetch all customers
        response = supabase.table("customers").select("*").order("name").execute()
        customers = response.data if response.data else []
        
        # Create an in-memory string buffer
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write CSV Headers
        writer.writerow([
            "ID", "Name", "Email", "Phone", "City", "Age", "Gender", 
            "Total Orders", "Total Spent ($)", "Last Purchase Date", 
            "Dormancy Status", "RFM Score", "RFM Segment", "Churn Risk (%)", "Tags"
        ])
        
        # Write Row Data
        for c in customers:
            writer.writerow([
                c.get("id"),
                c.get("name"),
                c.get("email"),
                c.get("phone"),
                c.get("city"),
                c.get("age"),
                c.get("gender"),
                c.get("total_orders"),
                c.get("total_spent"),
                c.get("last_purchase_date"),
                c.get("dormancy_status"),
                c.get("rfm_score"),
                c.get("rfm_segment"),
                c.get("churn_risk"),
                ", ".join(c.get("tags", [])) if isinstance(c.get("tags"), list) else ""
            ])
            
        output.seek(0)
        
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=maeven_customers_report.csv"}
        )
    except Exception as e:
        logger.error(f"Error exporting customers CSV: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate CSV export: {e}"
        )

@router.get("/", response_model=List[CustomerResponse])
async def list_customers(
    search: Optional[str] = Query(None, description="Search by name or email"),
    city: Optional[str] = Query(None, description="Filter by city"),
    rfm_segment: Optional[str] = Query(None, description="Filter by RFM segment"),
    dormancy_status: Optional[str] = Query(None, description="Filter by dormancy status"),
    min_spent: Optional[float] = Query(None, description="Filter by minimum spent"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """
    List customers with search queries, specific status filters, and pagination.
    """
    query = supabase.table("customers").select("*")

    # Apply search filter
    if search:
        query = query.or_(f"name.ilike.%{search}%,email.ilike.%{search}%")
    
    # Apply exact filters
    if city:
        query = query.eq("city", city)
    if rfm_segment:
        query = query.eq("rfm_segment", rfm_segment)
    if dormancy_status:
        query = query.eq("dormancy_status", dormancy_status)
    if min_spent is not None:
        query = query.gte("total_spent", min_spent)

    # Order and paginate
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    
    response = query.execute()
    customers = response.data if response.data else []

    if customers:
        cust_ids = [c["id"] for c in customers]
        try:
            orders_resp = supabase.table("orders").select("customer_id, order_value, order_date").in_("customer_id", cust_ids).execute()
            orders = orders_resp.data if orders_resp.data else []
            
            # Group orders by customer
            customer_orders = {}
            for o in orders:
                c_id = o["customer_id"]
                if c_id not in customer_orders:
                    customer_orders[c_id] = []
                customer_orders[c_id].append(o)
                
            for c in customers:
                c_id = c["id"]
                c_orders = customer_orders.get(c_id, [])
                if c_orders:
                    c["total_orders"] = len(c_orders)
                    c["total_spent"] = round(sum(float(o["order_value"]) for o in c_orders), 2)
                    
                    dates = []
                    for o in c_orders:
                        dt_str = o["order_date"].replace("Z", "+00:00")
                        dates.append(datetime.fromisoformat(dt_str))
                    c["last_purchase_date"] = max(dates).isoformat()
                else:
                    c["total_orders"] = 0
                    c["total_spent"] = 0.00
                    c["last_purchase_date"] = None
        except Exception as e:
            logger.error(f"Error dynamically calculating search customer aggregates: {e}")

    return customers

@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: UUID):
    """
    Retrieve details of a single customer by UUID with dynamically calculated stats.
    """
    response = supabase.table("customers").select("*").eq("id", str(customer_id)).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Customer with ID {customer_id} not found"
        )
    customer = response.data[0]

    # Fetch orders to dynamically compute up-to-date stats
    try:
        orders_resp = supabase.table("orders").select("order_value, order_date").eq("customer_id", str(customer_id)).execute()
        orders = orders_resp.data if orders_resp.data else []
        
        if orders:
            customer["total_orders"] = len(orders)
            customer["total_spent"] = round(sum(float(o["order_value"]) for o in orders), 2)
            
            dates = []
            for o in orders:
                dt_str = o["order_date"].replace("Z", "+00:00")
                dates.append(datetime.fromisoformat(dt_str))
            customer["last_purchase_date"] = max(dates).isoformat()
        else:
            customer["total_orders"] = 0
            customer["total_spent"] = 0.00
            customer["last_purchase_date"] = None
    except Exception as e:
        logger.error(f"Error dynamically calculating single customer stats: {e}")

    return customer

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(payload: CustomerCreate):
    """
    Create a new customer profile.
    """
    customer_data = payload.model_dump(mode="json")
    # Add CRM analytic default values
    customer_data.update({
        "total_orders": 0,
        "total_spent": 0.00,
        "last_purchase_date": None,
        "dormancy_status": "active",
        "rfm_score": None,
        "rfm_segment": "Recent/New",
        "churn_risk": 5.0
    })
    
    response = supabase.table("customers").insert(customer_data).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Failed to create customer record"
        )
    return response.data[0]

@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: UUID, payload: CustomerUpdate):
    """
    Update details of an existing customer profile.
    """
    update_data = payload.model_dump(exclude_unset=True, mode="json")
    if not update_data:
        # Fetch current record if no updates provided
        return await get_customer(customer_id)
        
    response = supabase.table("customers").update(update_data).eq("id", str(customer_id)).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Customer with ID {customer_id} not found or update failed"
        )
    return response.data[0]

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(customer_id: UUID):
    """
    Remove a customer profile from the system.
    """
    response = supabase.table("customers").delete().eq("id", str(customer_id)).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Customer with ID {customer_id} not found"
        )
    return None

@router.post("/recompute-rfm", dependencies=[Depends(verify_session), Depends(rfm_limiter)], status_code=status.HTTP_200_OK)
async def recompute_customers_rfm():
    """
    Runs an analytical job across all customers to recompute order counts, values,
    and RFM scores from order events, updating metrics back to the database.
    """
    # 1. Fetch all orders (capped at a large number for safety)
    orders_resp = supabase.table("orders").select("customer_id, order_value, order_date").limit(5000).execute()
    orders = orders_resp.data if orders_resp.data else []
    
    # Group orders by customer
    customer_orders = {}
    for o in orders:
        c_id = o["customer_id"]
        if c_id not in customer_orders:
            customer_orders[c_id] = []
        customer_orders[c_id].append(o)
        
    # 2. Fetch all customers
    customers_resp = supabase.table("customers").select("id, name, email").limit(1000).execute()
    customers = customers_resp.data if customers_resp.data else []
    
    updated_records = []
    
    for cust in customers:
        c_id = cust["id"]
        c_orders = customer_orders.get(c_id, [])
        
        if not c_orders:
            # Set default metrics for customers with no orders
            updated_records.append({
                "id": c_id,
                "name": cust["name"],
                "email": cust["email"],
                "total_orders": 0,
                "total_spent": 0.00,
                "last_purchase_date": None,
                "rfm_score": 111,
                "rfm_segment": "Lost",
                "dormancy_status": "dormant",
                "churn_risk": 95.00,
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
            continue
            
        total_orders = len(c_orders)
        total_spent = round(sum(float(o["order_value"]) for o in c_orders), 2)
        
        # Parse ISO timestamps
        dates = []
        for o in c_orders:
            dt_str = o["order_date"].replace("Z", "+00:00")
            dates.append(datetime.fromisoformat(dt_str))
            
        latest_purchase = max(dates)
        
        # RFM Score Quantile Logic
        # 1. Recency: Days since purchase relative to reference current date
        days_ago = (CURRENT_DATE - latest_purchase).days
        if days_ago < 45:
            recency = 5
        elif days_ago < 120:
            recency = 4
        elif days_ago < 240:
            recency = 3
        elif days_ago < 450:
            recency = 2
        else:
            recency = 1
            
        # 2. Frequency: Total orders
        if total_orders >= 6:
            frequency = 5
        elif total_orders >= 4:
            frequency = 4
        elif total_orders >= 3:
            frequency = 3
        elif total_orders >= 2:
            frequency = 2
        else:
            frequency = 1
            
        # 3. Monetary: Total spent
        if total_spent >= 1200.00:
            monetary = 5
        elif total_spent >= 600.00:
            monetary = 4
        elif total_spent >= 300.00:
            monetary = 3
        elif total_spent >= 150.00:
            monetary = 2
        else:
            monetary = 1
            
        rfm_score = recency * 100 + frequency * 10 + monetary
        
        # Segment definition
        if recency >= 4 and frequency >= 4 and monetary >= 4:
            rfm_segment = "Champions"
        elif recency >= 3 and frequency >= 3 and monetary >= 3:
            rfm_segment = "Loyal Customers"
        elif recency >= 4 and frequency <= 2:
            rfm_segment = "Recent/New"
        elif recency == 3 and frequency <= 2:
            rfm_segment = "Needs Attention"
        elif recency == 2 and frequency >= 3:
            rfm_segment = "About to Sleep"
        elif recency == 2 and frequency <= 2:
            rfm_segment = "Hibernating"
        elif recency == 1 and frequency >= 3:
            rfm_segment = "Can't Lose Them"
        else:
            rfm_segment = "Lost"
            
        # Dormancy status & Churn risk
        if recency >= 4:
            dormancy_status = "active"
            churn_risk = 15.00
        elif recency >= 2:
            dormancy_status = "at_risk"
            churn_risk = 45.00
        else:
            dormancy_status = "dormant"
            churn_risk = 85.00
            
        updated_records.append({
            "id": c_id,
            "name": cust["name"],
            "email": cust["email"],
            "total_orders": total_orders,
            "total_spent": total_spent,
            "last_purchase_date": latest_purchase.isoformat(),
            "rfm_score": rfm_score,
            "rfm_segment": rfm_segment,
            "dormancy_status": dormancy_status,
            "churn_risk": churn_risk,
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
        
    # Bulk upsert the compiled analytic scores (using PostgREST merge syntax)
    chunk_size = 100
    for i in range(0, len(updated_records), chunk_size):
        chunk = updated_records[i:i + chunk_size]
        supabase.table("customers").upsert(chunk).execute()
        
    return {"status": "success", "processed_records_count": len(updated_records)}


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_customers(file: UploadFile = File(...)):
    """
    Imports customer data from a CSV or Excel file.
    New emails are inserted, existing emails are updated (upsert by email).
    """
    try:
        filename = file.filename.lower()
        if not filename.endswith((".csv", ".xlsx", ".xls")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload a CSV or Excel file (.csv, .xlsx, .xls)."
            )

        contents = await file.read()
        
        # Read into DataFrame
        if filename.endswith(".csv"):
            try:
                df = pd.read_csv(io.BytesIO(contents))
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(contents), encoding="latin1")
        else:  # .xlsx or .xls
            df = pd.read_excel(io.BytesIO(contents))

        if df.empty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file is empty."
            )

        # Normalize column names: lowercase, strip, spaces to underscores
        columns_map = {col: str(col).strip().lower().replace(" ", "_") for col in df.columns}
        df = df.rename(columns=columns_map)

        # Check required columns
        # Try to find name and email
        email_col = None
        name_col = None
        for col in df.columns:
            if col in ["email", "email_address"]:
                email_col = col
            if col in ["name", "full_name", "customer_name"]:
                name_col = col

        if not name_col or not email_col:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required columns. The file must contain at least 'Name' and 'Email' columns."
            )

        # Drop rows with null name or email
        df = df.dropna(subset=[name_col, email_col])
        
        # Clean email strings and remove empty ones
        df[email_col] = df[email_col].astype(str).str.strip().str.lower()
        df = df[df[email_col] != ""]
        
        # Deduplicate records by email to prevent Postgres ON CONFLICT row double-update error
        df = df.drop_duplicates(subset=[email_col], keep="last")
        
        # Parse records
        records = []
        for _, row in df.iterrows():
            email_val = str(row[email_col]).strip().lower()
            name_val = str(row[name_col]).strip()
            
            if not email_val or not name_val:
                continue

            record = {
                "name": name_val,
                "email": email_val
            }

            # Optional: Phone
            phone_col = next((c for c in df.columns if c in ["phone", "phone_number"]), None)
            if phone_col and pd.notna(row[phone_col]):
                record["phone"] = str(row[phone_col]).strip()

            # Optional: City
            city_col = next((c for c in df.columns if c in ["city", "location"]), None)
            if city_col and pd.notna(row[city_col]):
                record["city"] = str(row[city_col]).strip()

            # Optional: Age
            age_col = next((c for c in df.columns if c in ["age"]), None)
            if age_col and pd.notna(row[age_col]):
                try:
                    record["age"] = int(row[age_col])
                except (ValueError, TypeError):
                    pass

            # Optional: Gender
            gender_col = next((c for c in df.columns if c in ["gender"]), None)
            if gender_col and pd.notna(row[gender_col]):
                record["gender"] = str(row[gender_col]).strip()

            # Optional: Tags (either as array or comma-separated string)
            tags_col = next((c for c in df.columns if c in ["tags"]), None)
            if tags_col and pd.notna(row[tags_col]):
                tags_val = row[tags_col]
                if isinstance(tags_val, str):
                    tags_list = [t.strip() for t in tags_val.split(",") if t.strip()]
                elif isinstance(tags_val, list):
                    tags_list = [str(t).strip() for t in tags_val if str(t).strip()]
                else:
                    tags_list = [str(tags_val).strip()]
                record["tags"] = tags_list

            # Analytic values: total_orders
            orders_col = next((c for c in df.columns if c in ["total_orders", "orders"]), None)
            if orders_col and pd.notna(row[orders_col]):
                try:
                    record["total_orders"] = int(row[orders_col])
                except (ValueError, TypeError):
                    record["total_orders"] = 0
            else:
                record["total_orders"] = 0

            # Analytic values: total_spent
            spent_col = next((c for c in df.columns if c in ["total_spent", "spent", "revenue", "total_spent_($)"]), None)
            if spent_col and pd.notna(row[spent_col]):
                try:
                    # Strip any dollar sign prefix if parsed as string
                    val_str = str(row[spent_col]).replace("$", "").strip()
                    record["total_spent"] = round(float(val_str), 2)
                except (ValueError, TypeError):
                    record["total_spent"] = 0.00
            else:
                record["total_spent"] = 0.00

            # Optional: last_purchase_date
            lp_col = next((c for c in df.columns if c in ["last_purchase_date", "last_purchase"]), None)
            if lp_col and pd.notna(row[lp_col]):
                try:
                    dt_str = str(row[lp_col]).strip()
                    # standard parse
                    record["last_purchase_date"] = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).isoformat()
                except Exception:
                    pass

            # Optional: dormancy_status
            dorm_col = next((c for c in df.columns if c in ["dormancy_status", "dormancy"]), None)
            if dorm_col and pd.notna(row[dorm_col]):
                status_val = str(row[dorm_col]).strip().lower()
                if status_val in ["active", "at_risk", "dormant"]:
                    record["dormancy_status"] = status_val
                else:
                    record["dormancy_status"] = "active"
            else:
                record["dormancy_status"] = "active"

            # Optional: rfm_segment
            segment_col = next((c for c in df.columns if c in ["rfm_segment", "segment"]), None)
            if segment_col and pd.notna(row[segment_col]):
                record["rfm_segment"] = str(row[segment_col]).strip()
            else:
                record["rfm_segment"] = "Recent/New"

            # Optional: churn_risk
            churn_col = next((c for c in df.columns if c in ["churn_risk", "churn", "churn_risk_(%)"]), None)
            if churn_col and pd.notna(row[churn_col]):
                try:
                    val_str = str(row[churn_col]).replace("%", "").strip()
                    record["churn_risk"] = round(float(val_str), 2)
                except (ValueError, TypeError):
                    record["churn_risk"] = 5.00
            else:
                record["churn_risk"] = 5.00

            records.append(record)

        if not records:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid customer records could be parsed from the file."
            )

        # Chunk and upsert
        chunk_size = 100
        for i in range(0, len(records), chunk_size):
            chunk = records[i:i + chunk_size]
            supabase.table("customers").upsert(chunk, on_conflict="email").execute()

        return {
            "status": "success",
            "message": f"Successfully processed {len(records)} records.",
            "processed_count": len(records)
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error importing customer list: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file import: {str(e)}"
        )

