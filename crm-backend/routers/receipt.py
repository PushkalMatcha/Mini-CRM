import os
from fastapi import APIRouter, Header, HTTPException, status
from models import supabase
from schemas import ReceiptWebhookPayload
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/receipt", tags=["Receipts"])

EXPECTED_SECRET = os.environ.get("WEBHOOK_SECRET", "maeven_secure_webhook_key_2026")

@router.post("/", status_code=status.HTTP_200_OK)
async def process_delivery_receipt(
    payload: ReceiptWebhookPayload,
    x_webhook_secret: str = Header(None)
):
    """
    Webhook callback handler that receives message lifecycle event updates from the channel-stub service.
    Updates the communication log and increments the campaign analytics.
    """
    if not x_webhook_secret or x_webhook_secret != EXPECTED_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Invalid webhook signature."
        )
    comm_id = str(payload.communication_id)
    event_val = payload.event.lower()
    timestamp_iso = payload.timestamp.isoformat()
    
    # 1. Fetch communication log to verify existence and get campaign_id
    comm_resp = supabase.table("communications").select("id", "campaign_id", "status").eq("id", comm_id).execute()
    if not comm_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Communication record with ID {comm_id} not found."
        )
        
    communication = comm_resp.data[0]
    campaign_id = payload.campaign_id or communication["campaign_id"]
    
    # 2. Map event to status and database column updates
    # We map 'bounced' to a DB status of 'failed' and increment the 'failed' campaign statistic.
    status_db = event_val
    if event_val == "bounced":
        status_db = "failed"
        
    update_fields = {"status": status_db}
    rpc_field = None
    
    if event_val == "delivered":
        update_fields["delivered_at"] = timestamp_iso
        rpc_field = "delivered"
    elif event_val in ["failed", "bounced"]:
        update_fields["failed_at"] = timestamp_iso
        rpc_field = "failed"
    elif event_val == "opened":
        update_fields["opened_at"] = timestamp_iso
        rpc_field = "opened"
    elif event_val == "read":
        update_fields["read_at"] = timestamp_iso
        rpc_field = "read_count" # Maps to read_count field in the campaign_stats schema & RPC
    elif event_val == "clicked":
        update_fields["clicked_at"] = timestamp_iso
        rpc_field = "clicked"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported lifecycle event: {event_val}"
        )
        
    # 3. Update communication status and timestamp
    update_resp = supabase.table("communications").update(update_fields).eq("id", comm_id).execute()
    if not update_resp.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to update communication log."
        )
        
    # 4. Trigger database RPC to safely increment campaign stats and recompute rates
    if rpc_field and campaign_id:
        try:
            supabase.rpc("increment_campaign_stat", {
                "p_campaign_id": str(campaign_id),
                "p_field": rpc_field
            }).execute()
        except Exception as e:
            logger.error(f"Failed to increment campaign stats via RPC for campaign {campaign_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update analytical statistics: {e}"
            )
            
    return {"message": "Lifecycle event processed successfully", "communication_id": comm_id, "event": event_val, "status_db": status_db}
