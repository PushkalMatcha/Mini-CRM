import random
import asyncio
import logging
from datetime import datetime, timezone
from callbacks import dispatch_webhook_callback

logger = logging.getLogger(__name__)

async def simulate_message_lifecycle(
    communication_id: str, 
    campaign_id: str, 
    customer_id: str, 
    channel: str, 
    message: str
):
    """
    Simulates asynchronous transmission and user interaction lifecycle for a message.
    
    Probabilities:
    - 85% Delivered, 10% Failed, 5% Bounced.
    - If Delivered:
        - 60% Opened
        - If Opened:
            - 40% Read
            - If Read:
                - 25% Clicked
    """
    comm_id_str = str(communication_id)
    camp_id_str = str(campaign_id)
    cust_id_str = str(customer_id)
    
    logger.info(f"Starting async simulation loop for message {comm_id_str} (Customer: {cust_id_str}, Channel: {channel})")
    
    # 1. Simulate dispatch transmission latency (1 to 8 seconds delay)
    transmission_delay = random.uniform(1.0, 8.0)
    await asyncio.sleep(transmission_delay)
    
    # Determine delivery outcome
    outcome_rand = random.random()
    
    if outcome_rand < 0.10:
        # 10% Failure
        event = "failed"
    elif outcome_rand < 0.15:
        # 5% Bounce (0.10 to 0.15 range is 5%)
        event = "bounced"
    else:
        # 85% Delivered
        event = "delivered"
        
    # Dispatch first state callback
    now_iso = datetime.now(timezone.utc).isoformat()
    await dispatch_webhook_callback(comm_id_str, camp_id_str, event, now_iso)
    
    # Terminate simulation flow if failed or bounced
    if event != "delivered":
        logger.info(f"Message {comm_id_str} halted at terminal state '{event}'")
        return
        
    # 2. Simulate User opening the message (60% chance)
    await asyncio.sleep(random.uniform(1.0, 5.0))
    if random.random() >= 0.60:
        logger.info(f"Message {comm_id_str} delivered but was not opened by user.")
        return
        
    event = "opened"
    now_iso = datetime.now(timezone.utc).isoformat()
    await dispatch_webhook_callback(comm_id_str, camp_id_str, event, now_iso)
    
    # 3. Simulate User reading the message (40% of opened messages)
    await asyncio.sleep(random.uniform(1.0, 4.0))
    if random.random() >= 0.40:
        logger.info(f"Message {comm_id_str} opened but not read.")
        return
        
    event = "read"
    now_iso = datetime.now(timezone.utc).isoformat()
    await dispatch_webhook_callback(comm_id_str, camp_id_str, event, now_iso)
    
    # 4. Simulate User clicking a link (25% of read messages)
    await asyncio.sleep(random.uniform(1.0, 4.0))
    if random.random() >= 0.25:
        logger.info(f"Message {comm_id_str} read but no link was clicked.")
        return
        
    event = "clicked"
    now_iso = datetime.now(timezone.utc).isoformat()
    await dispatch_webhook_callback(comm_id_str, camp_id_str, event, now_iso)
    
    logger.info(f"Message {comm_id_str} completed full lifecycle path (Clicked)")
