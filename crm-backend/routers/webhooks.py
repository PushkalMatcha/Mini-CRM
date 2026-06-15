from fastapi import APIRouter, BackgroundTasks, status
from pydantic import BaseModel
from models import supabase
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

class WebhookPayload(BaseModel):
    order_id: str
    customer_email: str
    event_status: str

def map_event_status_to_stage(event_status: str) -> str:
    """
    Maps incoming e-commerce event status (Shopify/Stripe/etc) to Deal pipeline stage.
    """
    status_lower = event_status.lower().strip()
    if status_lower in ["payment_processed", "order_shipped", "fulfilled", "payment_succeeded", "completed"]:
        return "closed_won"
    elif status_lower in ["payment_failed", "order_cancelled", "cancelled", "refunded", "cart_abandoned"]:
        return "closed_lost"
    elif status_lower in ["checkout_started", "checkout_completed"]:
        return "qualified"
    elif status_lower in ["cart_created", "lead_created"]:
        return "prospect"
    else:
        # Default fallback
        logger.warning(f"Unknown event status '{event_status}'. Falling back to 'prospect' stage.")
        return "prospect"

def process_webhook_update(payload: WebhookPayload):
    """
    Internal background task to query the customer, find their latest active deal,
    and update its stage to match the event status. If no deal exists, a new deal is created.
    """
    email = payload.customer_email
    try:
        # 1. Fetch customer details
        cust_resp = supabase.table("customers").select("id, name").eq("email", email).execute()
        if not cust_resp.data:
            logger.warning(f"[Webhook Update] Customer with email {email} not found in database. Ignoring event.")
            return

        customer_id = cust_resp.data[0]["id"]
        customer_name = cust_resp.data[0]["name"]
        target_stage = map_event_status_to_stage(payload.event_status)

        # 2. Query latest deal for this customer
        deals_resp = supabase.table("deals").select("id, title, stage").eq("customer_id", customer_id).order("updated_at", desc=True).limit(1).execute()
        
        if deals_resp.data:
            # Update existing deal
            target_deal = deals_resp.data[0]
            logger.info(f"[Webhook Update] Updating existing deal '{target_deal['title']}' (ID: {target_deal['id']}) from '{target_deal['stage']}' to '{target_stage}'.")
            
            update_data = {
                "stage": target_stage,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            supabase.table("deals").update(update_data).eq("id", target_deal["id"]).execute()
        else:
            # If no deal exists, create a new one to represent this e-commerce purchase/activity
            deal_title = f"E-commerce Order {payload.order_id}"
            logger.info(f"[Webhook Update] No existing deals found. Creating new deal '{deal_title}' in stage '{target_stage}' for customer {customer_name}.")
            
            new_deal = {
                "customer_id": customer_id,
                "title": deal_title,
                "value": 0.00,  # Default value
                "stage": target_stage,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            supabase.table("deals").insert(new_deal).execute()

    except Exception as e:
        logger.error(f"[Webhook Update] Error processing webhook for email {email}: {e}", exc_info=True)

@router.post("/order-update", status_code=status.HTTP_200_OK)
async def receive_order_update(payload: WebhookPayload, background_tasks: BackgroundTasks):
    """
    Receives external e-commerce events (e.g. from Stripe, Shopify) and queues database updates.
    """
    logger.info(f"Webhook received: Order ID={payload.order_id}, Email={payload.customer_email}, Status={payload.event_status}")
    background_tasks.add_task(process_webhook_update, payload)
    return {"status": "accepted", "message": "Webhook queued for processing"}
