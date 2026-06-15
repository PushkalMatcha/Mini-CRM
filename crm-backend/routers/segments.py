import os
import json
import httpx
import logging
from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional, Dict, Any
from uuid import UUID
from models import supabase
from schemas import SegmentCreate, SegmentResponse, CustomerResponse, SegmentFilters

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/segments", tags=["Segments"])

# Grok credentials
XAI_API_KEY = os.environ.get("XAI_API_KEY") or os.environ.get("GROK_API_KEY")
XAI_BASE_URL = os.environ.get("XAI_BASE_URL", "https://api.xai.ai/v1")
XAI_MODEL = os.environ.get("XAI_MODEL", "grok-beta")

def evaluate_segment_rules(filter_rules: Dict[str, Any]) -> int:
    """
    Helper function to query the supabase customer table and return the matching record count.
    """
    query = supabase.table("customers").select("id", count="exact")
    
    if isinstance(filter_rules, dict):
        for field, value in filter_rules.items():
            if value is None:
                continue
            if field == "min_spent":
                query = query.gte("total_spent", float(value))
            elif field == "max_spent":
                query = query.lte("total_spent", float(value))
            elif field == "min_age":
                query = query.gte("age", int(value))
            elif field == "max_age":
                query = query.lte("age", int(value))
            elif field == "tags" and isinstance(value, list):
                for tag in value:
                    query = query.csv("tags", tag)
            else:
                query = query.eq(field, value)
                    
    try:
        response = query.execute()
        return len(response.data) if response.data else 0
    except Exception as e:
        logger.error(f"Error evaluating segment rules count: {e}")
        return 0

def local_regex_compile(nl_query: str) -> dict:
    """
    Regex fallback query compiler if the Grok API is not available or encounters an error.
    """
    query_lower = nl_query.lower()
    filters = {}
    
    # 1. Parse common cities
    for city in ["mumbai", "delhi", "bangalore", "hyderabad", "chennai", "kolkata", "pune", "goa", "jaipur"]:
        if city in query_lower:
            filters["city"] = city.capitalize()
            break
            
    # 2. Parse RFM segments
    if "champion" in query_lower:
        filters["rfm_segment"] = "Champions"
    elif "loyal" in query_lower:
        filters["rfm_segment"] = "Loyal Customers"
    elif "new" in query_lower or "recent" in query_lower:
        filters["rfm_segment"] = "Recent/New"
    elif "sleep" in query_lower:
        filters["rfm_segment"] = "About to Sleep"
    elif "hibernating" in query_lower:
        filters["rfm_segment"] = "Hibernating"
    elif "lost" in query_lower:
        filters["rfm_segment"] = "Lost"
        
    # 3. Parse dormancy status
    if "active" in query_lower:
        filters["dormancy_status"] = "active"
    elif "at risk" in query_lower or "at_risk" in query_lower:
        filters["dormancy_status"] = "at_risk"
    elif "dormant" in query_lower:
        filters["dormancy_status"] = "dormant"
        
    # 4. Parse age
    if "over" in query_lower and "age" in query_lower:
        words = query_lower.split()
        for idx, w in enumerate(words):
            if w in ["over", "above", ">"] and idx + 1 < len(words):
                try:
                    filters["min_age"] = int(words[idx+1].replace(",", ""))
                except ValueError:
                    pass
                    
    # 5. Parse monetary values
    if "spent over" in query_lower or "spent >" in query_lower or "spent more than" in query_lower:
        words = query_lower.split()
        for idx, w in enumerate(words):
            if w in ["over", ">", "than"] and idx + 1 < len(words):
                try:
                    num_val = words[idx+1].replace(",", "").replace("$", "").replace("rs", "")
                    filters["min_spent"] = float(num_val)
                except ValueError:
                    pass
                    
    return filters

async def compile_nl_to_filters(nl_query: str) -> dict:
    """
    Sends natural language query to Grok to compile it into structured logic.
    Falls back to regex-based parser if xAI keys are not configured.
    """
    if not XAI_API_KEY:
        logger.warning("No XAI_API_KEY configured. Falling back to local segment query parser.")
        return local_regex_compile(nl_query)

    prompt = f"""
    You are a database parser for Maeven CRM, a premium retail analytics engine.
    Convert this natural language query into a JSON filter config targeting the customer database.
    
    Customer Database Columns:
    - name: TEXT
    - email: TEXT
    - phone: TEXT
    - city: TEXT
    - age: INTEGER
    - gender: TEXT
    - tags: TEXT[] (e.g. vip, high-intent, first-time, gifting-heavy, festive-shopper)
    - total_orders: INTEGER
    - total_spent: NUMERIC
    - last_purchase_date: TIMESTAMP
    - dormancy_status: TEXT (active, at_risk, dormant)
    - rfm_segment: TEXT (Champions, Loyal Customers, Recent/New, About to Sleep, Hibernating, Lost)
    
    Supported JSON return filter parameters:
    - city: TEXT (exact match, e.g. "Mumbai")
    - rfm_segment: TEXT (exact match, e.g. "Champions")
    - dormancy_status: TEXT (exact match, e.g. "active")
    - gender: TEXT (exact match, e.g. "Female")
    - min_spent: NUMERIC (total_spent >= min_spent)
    - max_spent: NUMERIC (total_spent <= max_spent)
    - min_age: INTEGER (age >= min_age)
    - max_age: INTEGER (age <= max_age)
    - tags: TEXT[] (array of strings representing tags that the customer must have)
    
    Natural Language Query: "{nl_query}"
    
    Return ONLY a raw JSON object containing these filters. No formatting, no markdown ticks, no comments.
    Example response structure:
    {{
        "city": "Mumbai",
        "min_spent": 500
    }}
    """
    
    try:
        headers = {
            "Authorization": f"Bearer {XAI_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "model": XAI_MODEL,
            "messages": [
                {"role": "system", "content": "You are a database query compiler that outputs only valid raw JSON matching schemas."},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.0
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{XAI_BASE_URL}/chat/completions",
                headers=headers,
                json=data,
                timeout=12.0
            )
            if response.status_code != 200:
                logger.error(f"Grok API segment compiler returned error code: {response.status_code}")
                return local_regex_compile(nl_query)
                
            res_json = response.json()
            content_str = res_json["choices"][0]["message"]["content"].strip()
            
            # Clean markdown formatting if Grok added any
            if content_str.startswith("```"):
                lines = content_str.split("\n")
                if lines[0].startswith("```json"):
                    content_str = "\n".join(lines[1:-1])
                else:
                    content_str = "\n".join(lines[1:-1])
                    
            return json.loads(content_str)
            
    except Exception as e:
        logger.error(f"Exception compiling Natural Language segment using Grok: {e}")
        return local_regex_compile(nl_query)

@router.get("/", response_model=List[SegmentResponse])
async def list_segments():
    """
    List all created customer segments.
    """
    response = supabase.table("segments").select("*").order("created_at", desc=True).execute()
    return response.data

@router.post("/", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED)
async def create_segment(payload: SegmentCreate):
    """
    Create a new segment. Evaluates natural language queries if no logical rules are provided,
    previews audience sizes, and saves the segment logic with strict Pydantic validation.
    """
    segment_data = payload.model_dump(mode="json")
    filter_json = segment_data.get("filter_json")
    nl_query = segment_data.get("nl_query")
    
    # Compile natural language query if filter_json is not supplied
    if (not filter_json or filter_json == {}) and nl_query:
        logger.info(f"Compiling natural language segment query: {nl_query}")
        compiled_filters = await compile_nl_to_filters(nl_query)
        filter_json = compiled_filters
        if not segment_data.get("description"):
            segment_data["description"] = f"AI-compiled segment based on: {nl_query}"

    # Enforce strict validation on filter_json
    if filter_json:
        try:
            validated_filters = SegmentFilters.model_validate(filter_json)
            segment_data["filter_json"] = validated_filters.model_dump()
            filter_json = segment_data["filter_json"]
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Segment filters validation failed: {e}"
            )
    else:
        # Default empty filter_json if nothing was supplied/compiled
        segment_data["filter_json"] = {}
        filter_json = {}
            
    # Calculate count of matching customers
    customer_count = evaluate_segment_rules(filter_json)
    segment_data["customer_count"] = customer_count
    
    response = supabase.table("segments").insert(segment_data).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Failed to create segment record"
        )
    return response.data[0]

@router.get("/{segment_id}", response_model=SegmentResponse)
async def get_segment(segment_id: UUID):
    """
    Retrieve details of a single segment.
    """
    response = supabase.table("segments").select("*").eq("id", str(segment_id)).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Segment with ID {segment_id} not found"
        )
    return response.data[0]

@router.post("/evaluate", response_model=Dict[str, Any])
async def evaluate_segment_preview(filter_json: Dict[str, Any]):
    """
    Dry-run segment rules to preview how many customers match without saving the segment.
    """
    count = evaluate_segment_rules(filter_json)
    return {
        "matching_customers_count": count,
        "rules_received": filter_json
    }

@router.get("/{segment_id}/customers", response_model=List[CustomerResponse])
async def get_segment_customers(segment_id: UUID):
    """
    Retrieve all customer records matched by the Segment's logical filter rules.
    """
    # 1. Fetch Segment filter rules
    segment_response = supabase.table("segments").select("*").eq("id", str(segment_id)).execute()
    if not segment_response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segment with ID {segment_id} not found"
        )
    
    segment = segment_response.data[0]
    filter_rules = segment.get("filter_json", {})
    
    # 2. Query customers applying filters
    query = supabase.table("customers").select("*")
    
    if isinstance(filter_rules, dict):
        for field, value in filter_rules.items():
            if value is None:
                continue
            if field == "min_spent":
                query = query.gte("total_spent", float(value))
            elif field == "max_spent":
                query = query.lte("total_spent", float(value))
            elif field == "min_age":
                query = query.gte("age", int(value))
            elif field == "max_age":
                query = query.lte("age", int(value))
            elif field == "tags" and isinstance(value, list):
                for tag in value:
                    query = query.csv("tags", tag)
            else:
                query = query.eq(field, value)
                    
    response = query.execute()
    return response.data

@router.delete("/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_segment(segment_id: UUID):
    """
    Delete a segment from the database.
    """
    response = supabase.table("segments").delete().eq("id", str(segment_id)).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Segment with ID {segment_id} not found"
        )
    return None
