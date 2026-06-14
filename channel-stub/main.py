import uvicorn
import logging
import os
from fastapi import FastAPI, BackgroundTasks, status
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from simulator import simulate_message_lifecycle

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Maeven CRM Async Channel Gateway Stub",
    description="Simulates messaging services (Email/SMS/WhatsApp) and reports async delivery notifications.",
    version="2.0.0"
)

# Configuration for CRM callback URL (passed to callbacks module)
CRM_RECEIPT_URL = os.environ.get("CRM_RECEIPT_URL", "http://localhost:8000")

class SendMessageRequest(BaseModel):
    communication_id: UUID
    campaign_id: Optional[UUID] = None
    customer_id: UUID
    channel: str # email, sms, whatsapp
    message: Optional[str] = None
    message_body: Optional[str] = None # Compatible fallback for Phase 1

    @property
    def msg_content(self) -> str:
        return self.message or self.message_body or ""

@app.post("/send", status_code=status.HTTP_200_OK)
async def send_message(payload: SendMessageRequest, background_tasks: BackgroundTasks):
    """
    Simulates sending a message. Accepts communication, customer, channel, and message.
    Triggers asynchronous background task simulation immediately and returns status queued.
    """
    logger.info(
        f"Queued message delivery. ID: {payload.communication_id}, Customer: {payload.customer_id}, Channel: {payload.channel}"
    )
    
    # Delegate simulation task to background execution thread
    background_tasks.add_task(
        simulate_message_lifecycle,
        str(payload.communication_id),
        str(payload.campaign_id) if payload.campaign_id else None,
        str(payload.customer_id),
        payload.channel,
        payload.msg_content
    )
    
    return {
        "status": "queued",
        "communication_id": payload.communication_id
    }

@app.get("/")
async def get_gateway_status():
    """
    Channel stub health state check.
    """
    return {
        "service": "Maeven CRM Async Channel Gateway Stub",
        "status": "online",
        "target_crm_url": CRM_RECEIPT_URL
    }

if __name__ == "__main__":
    logger.info("Starting Maeven CRM Async Channel Gateway Stub on Port 8001...")
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
