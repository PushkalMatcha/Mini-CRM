import os
import httpx
import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from models import supabase
from schemas import CampaignCreate, CampaignResponse, CampaignStatsResponse

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

# Channel stub base URL configuration
CHANNEL_STUB_URL = os.environ.get("CHANNEL_STUB_URL", "http://localhost:8001")

async def send_to_channel_stub(comm_id: str, campaign_id: str, customer_id: str, channel: str, body: str):
    """
    Helper function to dispatch a message to the channel-stub simulation engine.
    """
    async with httpx.AsyncClient() as client:
        try:
            payload = {
                "communication_id": comm_id,
                "campaign_id": campaign_id,
                "customer_id": customer_id,
                "channel": channel,
                "message": body
            }
            response = await client.post(f"{CHANNEL_STUB_URL}/send", json=payload, timeout=5.0)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to reach channel stub at {CHANNEL_STUB_URL}: {e}")
            return False

async def run_campaign_worker(campaign_id: str):
    """
    Background worker that runs campaign execution asynchronously.
    """
    try:
        # 1. Fetch Campaign and Segment
        campaign_resp = supabase.table("campaigns").select("*").eq("id", campaign_id).execute()
        if not campaign_resp.data:
            logger.error(f"Campaign {campaign_id} not found in database for execution.")
            return
            
        campaign = campaign_resp.data[0]
        segment_id = campaign.get("segment_id")
        channel = campaign.get("channel")
        template = campaign.get("message_template")
        
        # Update campaign status to processing
        supabase.table("campaigns").update({
            "status": "processing",
            "sent_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", campaign_id).execute()
        
        # Initialize campaign stats row in Postgres (to ensure it exists before RPC increments)
        try:
            supabase.table("campaign_stats").insert({
                "campaign_id": campaign_id,
                "total_sent": 0,
                "delivered": 0,
                "failed": 0,
                "opened": 0,
                "read_count": 0,
                "clicked": 0
            }).execute()
        except Exception:
            # Stats row might already exist, ignore conflict
            pass

        # 2. Resolve Customers in Segment
        customers = []
        if segment_id:
            # Fetch Segment rules
            seg_resp = supabase.table("segments").select("*").eq("id", segment_id).execute()
            if seg_resp.data:
                seg = seg_resp.data[0]
                filter_rules = seg.get("filter_json", {})
                
                # Fetch customers matching rules
                cust_query = supabase.table("customers").select("*")
                if isinstance(filter_rules, dict):
                    for field, value in filter_rules.items():
                        if value is None:
                            continue
                        if field == "min_spent":
                            cust_query = cust_query.gte("total_spent", float(value))
                        elif field == "max_spent":
                            cust_query = cust_query.lte("total_spent", float(value))
                        elif field == "min_age":
                            cust_query = cust_query.gte("age", int(value))
                        elif field == "max_age":
                            cust_query = cust_query.lte("age", int(value))
                        elif field == "tags" and isinstance(value, list):
                            for tag in value:
                                cust_query = cust_query.csv("tags", tag)
                        else:
                            cust_query = cust_query.eq(field, value)
                cust_resp = cust_query.execute()
                customers = cust_resp.data if cust_resp.data else []
        else:
            # Fallback to all customers if no segment specified
            cust_resp = supabase.table("customers").select("*").limit(100).execute()
            customers = cust_resp.data if cust_resp.data else []
            
        total_recipients = len(customers)
        
        # Update total recipients count
        supabase.table("campaigns").update({
            "total_recipients": total_recipients
        }).eq("id", campaign_id).execute()
        
        if total_recipients == 0:
            supabase.table("campaigns").update({
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", campaign_id).execute()
            return

        # 3. Dispatch communications
        for customer in customers:
            # Resolve customer attributes for personalization
            name = customer.get("name", "there")
            city = customer.get("city") or "your city"
            rfm = customer.get("rfm_segment") or "valued customer"
            
            # Segment-specific discount codes & personal notes
            rfm_lower = rfm.lower()
            if "champion" in rfm_lower:
                discount = "CHAMP25"
                note = "special deal only for you because you are our top champion and special to us!"
            elif "loyal" in rfm_lower:
                discount = "LOYAL20"
                note = "special deal only for you because we appreciate your loyalty and you are special to us!"
            elif "new" in rfm_lower or "recent" in rfm_lower:
                discount = "WELCOME15"
                note = "special deal only for you to welcome you to the family because you are special to us!"
            elif "sleep" in rfm_lower or "attention" in rfm_lower or "at risk" in rfm_lower or "at_risk" in rfm_lower:
                discount = "MISSYOU25"
                note = "special deal only for you because we miss your visits and you are special to us!"
            elif "lost" in rfm_lower or "hibernating" in rfm_lower:
                discount = "COMEBACK30"
                note = "special deal only for you because we want to win you back and you are special to us!"
            else:
                discount = "SPECIAL10"
                note = "special deal only for you cause you are special to us!"
            
            # Personalize message template with dynamic placeholders
            custom_body = template
            custom_body = custom_body.replace("{{name}}", name)
            custom_body = custom_body.replace("{{city}}", city)
            custom_body = custom_body.replace("{{rfm_segment}}", rfm)
            custom_body = custom_body.replace("{{discount_code}}", discount)
            custom_body = custom_body.replace("{{personal_note}}", note)
            
            recipient = customer.get("email") if channel == "email" else customer.get("phone", "")
            
            # Create communication log
            comm_data = {
                "campaign_id": campaign_id,
                "customer_id": customer["id"],
                "message_body": custom_body,
                "channel": channel,
                "status": "queued",
                "queued_at": datetime.now(timezone.utc).isoformat()
            }
            comm_resp = supabase.table("communications").insert(comm_data).execute()
            if not comm_resp.data:
                continue
                
            comm_id = comm_resp.data[0]["id"]
            
            # Send to Channel Stub Gateway
            success = await send_to_channel_stub(comm_id, campaign_id, customer["id"], channel, custom_body)
            
            if success:
                # Update communication to sent status
                supabase.table("communications").update({
                    "status": "sent",
                    "sent_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", comm_id).execute()
                
                # Increment total_sent via RPC
                supabase.rpc("increment_campaign_stat", {
                    "p_campaign_id": campaign_id,
                    "p_field": "total_sent"
                }).execute()
            else:
                # Update communication to failed status
                supabase.table("communications").update({
                    "status": "failed",
                    "failed_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", comm_id).execute()
                
                # Increment failed via RPC
                supabase.rpc("increment_campaign_stat", {
                    "p_campaign_id": campaign_id,
                    "p_field": "failed"
                }).execute()
                
        # 4. Finalize Campaign execution
        supabase.table("campaigns").update({
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", campaign_id).execute()
        
        logger.info(f"Campaign {campaign_id} execution completed successfully for {total_recipients} recipients.")
        
    except Exception as e:
        logger.error(f"Error executing campaign background task {campaign_id}: {e}")
        supabase.table("campaigns").update({
            "status": "failed"
        }).eq("id", campaign_id).execute()

@router.get("/", response_model=List[CampaignResponse])
async def list_campaigns():
    """
    List all marketing campaigns.
    """
    response = supabase.table("campaigns").select("*").order("created_at", desc=True).execute()
    return response.data

@router.post("/", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(payload: CampaignCreate):
    """
    Create a new campaign template in draft status.
    """
    campaign_data = payload.model_dump(mode="json")
    campaign_data.update({
        "status": "draft",
        "total_recipients": 0
    })
    response = supabase.table("campaigns").insert(campaign_data).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create campaign template")
    return response.data[0]

@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: UUID):
    """
    Retrieve details of a single campaign.
    """
    response = supabase.table("campaigns").select("*").eq("id", str(campaign_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return response.data[0]

@router.post("/{campaign_id}/execute", response_model=CampaignResponse)
async def execute_campaign(campaign_id: UUID, background_tasks: BackgroundTasks):
    """
    Trigger campaign execution. Spawns an asynchronous worker using FastAPI BackgroundTasks.
    """
    response = supabase.table("campaigns").select("*").eq("id", str(campaign_id)).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    campaign = response.data[0]
    if campaign["status"] in ["processing", "completed"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Campaign is already in status '{campaign['status']}' and cannot be executed again."
        )
        
    # Enqueue execution background task
    background_tasks.add_task(run_campaign_worker, str(campaign_id))
    
    # Return updated in-progress status immediately
    campaign["status"] = "processing"
    return campaign

@router.post("/{campaign_id}/send", response_model=CampaignResponse)
async def send_campaign(campaign_id: UUID, background_tasks: BackgroundTasks):
    """
    Alternative route trigger for campaign execution. Routes directly to the execute logic.
    """
    return await execute_campaign(campaign_id, background_tasks)


@router.get("/{campaign_id}/stats", response_model=CampaignStatsResponse)
async def get_campaign_stats(campaign_id: UUID):
    """
    Retrieve analytical performance statistics for a campaign.
    """
    response = supabase.table("campaign_stats").select("*").eq("campaign_id", str(campaign_id)).execute()
    if not response.data:
        # Return empty stats structure if not executed yet
        return {
            "campaign_id": campaign_id,
            "total_sent": 0,
            "delivered": 0,
            "failed": 0,
            "opened": 0,
            "read_count": 0,
            "clicked": 0,
            "delivery_rate": 0.00,
            "open_rate": 0.00,
            "click_rate": 0.00,
            "updated_at": datetime.now(timezone.utc)
        }
    return response.data[0]
