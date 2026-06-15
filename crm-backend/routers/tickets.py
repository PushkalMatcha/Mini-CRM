from fastapi import APIRouter, Depends, HTTPException, status as fastapi_status
from typing import List, Optional
from uuid import UUID
from models import supabase
from schemas import TicketCreate, TicketUpdate, TicketResponse
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tickets", tags=["Tickets"])

@router.get("/", response_model=List[TicketResponse])
async def list_tickets(status: Optional[str] = None, priority: Optional[str] = None):
    """
    Retrieve all tickets, accepting optional query parameters to filter by status and priority.
    Include the associated customer's name and email via SQL JOIN.
    """
    try:
        query = supabase.table("tickets").select("*, customers(name, email)")
        if status:
            query = query.eq("status", status)
        if priority:
            query = query.eq("priority", priority)
        
        response = query.order("created_at", desc=True).execute()
        data = response.data if response.data else []
        
        results = []
        for item in data:
            record = dict(item)
            cust = record.get("customers")
            if isinstance(cust, dict):
                record["customer_name"] = cust.get("name")
                record["customer_email"] = cust.get("email")
            else:
                record["customer_name"] = None
                record["customer_email"] = None
            if "customers" in record:
                del record["customers"]
            results.append(record)
        return results
    except Exception as e:
        logger.error(f"Error listing tickets: {e}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tickets: {str(e)}"
        )

@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(ticket_id: UUID):
    """
    Retrieve details of a specific ticket by ID.
    """
    try:
        response = supabase.table("tickets").select("*, customers(name, email)").eq("id", str(ticket_id)).execute()
        if not response.data:
            raise HTTPException(
                status_code=fastapi_status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        record = dict(response.data[0])
        cust = record.get("customers")
        if isinstance(cust, dict):
            record["customer_name"] = cust.get("name")
            record["customer_email"] = cust.get("email")
        else:
            record["customer_name"] = None
            record["customer_email"] = None
        if "customers" in record:
            del record["customers"]
        return record
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error fetching ticket {ticket_id}: {e}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch ticket: {str(e)}"
        )

@router.post("/", response_model=TicketResponse, status_code=fastapi_status.HTTP_201_CREATED)
async def create_ticket(payload: TicketCreate):
    """
    Create a new support ticket.
    """
    try:
        ticket_data = payload.model_dump(mode="json")
        response = supabase.table("tickets").insert(ticket_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=fastapi_status.HTTP_400_BAD_REQUEST,
                detail="Failed to create ticket record"
            )
        created_ticket = dict(response.data[0])
        
        # Populate customer details
        cust_resp = supabase.table("customers").select("name, email").eq("id", str(payload.customer_id)).execute()
        if cust_resp.data:
            created_ticket["customer_name"] = cust_resp.data[0]["name"]
            created_ticket["customer_email"] = cust_resp.data[0]["email"]
        else:
            created_ticket["customer_name"] = None
            created_ticket["customer_email"] = None
            
        return created_ticket
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error creating ticket: {e}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create ticket: {str(e)}"
        )

@router.patch("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(ticket_id: UUID, payload: TicketUpdate):
    """
    Update a ticket's status, priority, subject, or description.
    """
    try:
        update_data = payload.model_dump(exclude_unset=True, mode="json")
        if not update_data:
            return await get_ticket(ticket_id)
            
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        response = supabase.table("tickets").update(update_data).eq("id", str(ticket_id)).execute()
        if not response.data:
            raise HTTPException(
                status_code=fastapi_status.HTTP_404_NOT_FOUND,
                detail="Ticket not found or failed to update"
            )
        updated_ticket = dict(response.data[0])
        
        # Populate customer details
        cust_resp = supabase.table("customers").select("name, email").eq("id", str(updated_ticket["customer_id"])).execute()
        if cust_resp.data:
            updated_ticket["customer_name"] = cust_resp.data[0]["name"]
            updated_ticket["customer_email"] = cust_resp.data[0]["email"]
        else:
            updated_ticket["customer_name"] = None
            updated_ticket["customer_email"] = None
            
        return updated_ticket
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error updating ticket {ticket_id}: {e}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update ticket: {str(e)}"
        )

@router.delete("/{ticket_id}", status_code=fastapi_status.HTTP_204_NO_CONTENT)
async def delete_ticket(ticket_id: UUID):
    """
    Delete a ticket by ID.
    """
    try:
        response = supabase.table("tickets").delete().eq("id", str(ticket_id)).execute()
        if not response.data:
            raise HTTPException(
                status_code=fastapi_status.HTTP_404_NOT_FOUND,
                detail="Ticket not found"
            )
        return None
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error deleting ticket {ticket_id}: {e}")
        raise HTTPException(
            status_code=fastapi_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete ticket: {str(e)}"
        )
