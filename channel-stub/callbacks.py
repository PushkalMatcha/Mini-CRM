import os
import httpx
import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# CRM Backend receipt hook target URL
CRM_RECEIPT_URL = os.environ.get("CRM_RECEIPT_URL", "http://localhost:8000")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "maeven_secure_webhook_key_2026")

async def dispatch_webhook_callback(communication_id: str, campaign_id: str, event: str, timestamp: str):
    """
    Fires a POST request back to the CRM at {CRM_RECEIPT_URL}/api/receipt.
    Implements a basic retry loop (up to 3 attempts with progressive delay) on failure.
    """
    url = f"{CRM_RECEIPT_URL.rstrip('/')}/api/receipt/"
    payload = {
        "communication_id": communication_id,
        "campaign_id": campaign_id,
        "event": event,
        "timestamp": timestamp
    }
    headers = {
        "X-Webhook-Secret": WEBHOOK_SECRET
    }
    
    max_retries = 3
    retry_delays = [2.0, 4.0, 8.0] # progressive backoff intervals
    
    async with httpx.AsyncClient() as client:
        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"Attempt {attempt}/{max_retries}: Webhook dispatch -> ID: {communication_id}, Event: {event}")
                response = await client.post(url, json=payload, headers=headers, timeout=5.0, follow_redirects=True)
                
                if response.status_code == 200:
                    logger.info(f"Successfully delivered webhook event '{event}' for communication {communication_id}")
                    return True
                else:
                    logger.warning(
                        f"CRM server rejected webhook with status {response.status_code}. Response: {response.text}"
                    )
            except httpx.RequestError as e:
                logger.warning(f"Network error during webhook dispatch attempt {attempt}: {e}")
                
            # Sleep if there are more retries left
            if attempt < max_retries:
                delay = retry_delays[attempt - 1]
                logger.info(f"Retrying webhook callback in {delay} seconds...")
                await asyncio.sleep(delay)
                
        logger.error(
            f"Failed to dispatch webhook event '{event}' for communication {communication_id} after {max_retries} attempts."
        )
        return False
