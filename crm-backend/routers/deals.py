from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from uuid import UUID
from models import supabase
from schemas import DealCreate, DealUpdate, DealResponse
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/deals", tags=["Deals"])

@router.get("/", response_model=List[DealResponse])
async def list_deals():
    """
    Retrieve all deals with joined customer name.
    """
    try:
        response = supabase.table("deals").select("*, customers(name)").order("created_at", desc=True).execute()
        data = response.data if response.data else []
        results = []
        for item in data:
            record = dict(item)
            cust = record.get("customers")
            if isinstance(cust, dict):
                record["customer_name"] = cust.get("name")
            else:
                record["customer_name"] = None
            if "customers" in record:
                del record["customers"]
            results.append(record)
        return results
    except Exception as e:
        logger.error(f"Error listing deals: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch deals: {str(e)}"
        )

@router.get("/{deal_id}", response_model=DealResponse)
async def get_deal(deal_id: UUID):
    """
    Retrieve a specific deal by ID.
    """
    try:
        response = supabase.table("deals").select("*, customers(name)").eq("id", str(deal_id)).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )
        record = dict(response.data[0])
        cust = record.get("customers")
        if isinstance(cust, dict):
            record["customer_name"] = cust.get("name")
        else:
            record["customer_name"] = None
        if "customers" in record:
            del record["customers"]
        return record
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error fetching deal {deal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch deal: {str(e)}"
        )

@router.post("/", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(payload: DealCreate):
    """
    Create a new deal.
    """
    try:
        deal_data = payload.model_dump(mode="json")
        response = supabase.table("deals").insert(deal_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create deal record"
            )
        created_deal = dict(response.data[0])
        
        # Fetch customer name
        cust_resp = supabase.table("customers").select("name").eq("id", str(payload.customer_id)).execute()
        if cust_resp.data:
            created_deal["customer_name"] = cust_resp.data[0]["name"]
        else:
            created_deal["customer_name"] = None
            
        return created_deal
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error creating deal: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create deal: {str(e)}"
        )

@router.patch("/{deal_id}", response_model=DealResponse)
async def update_deal(deal_id: UUID, payload: DealUpdate):
    """
    Update deal properties.
    """
    try:
        update_data = payload.model_dump(exclude_unset=True, mode="json")
        if not update_data:
            return await get_deal(deal_id)
            
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        response = supabase.table("deals").update(update_data).eq("id", str(deal_id)).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found or failed to update"
            )
        updated_deal = dict(response.data[0])
        
        # Fetch customer name
        cust_resp = supabase.table("customers").select("name").eq("id", str(updated_deal["customer_id"])).execute()
        if cust_resp.data:
            updated_deal["customer_name"] = cust_resp.data[0]["name"]
        else:
            updated_deal["customer_name"] = None
            
        return updated_deal
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error updating deal {deal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update deal: {str(e)}"
        )

@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deal(deal_id: UUID):
    """
    Delete a deal by ID.
    """
    try:
        response = supabase.table("deals").delete().eq("id", str(deal_id)).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deal not found"
            )
        return None
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error deleting deal {deal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete deal: {str(e)}"
        )
