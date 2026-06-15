import random
import uuid
import sys
from datetime import datetime, timedelta, timezone
from models import supabase

DEAL_TITLES = [
    "Elysian Diamond Solitaire Ring Purchase",
    "Gilded Cuff Bracelet Bulk Customization",
    "Luna Stackable Band Set Order",
    "Siren Hoops Jewelry Selection",
    "Heritage Jhumkas Wedding Collection Deal",
    "Celestia Lariat Pendant Custom Order",
    "Meadow Drop Earrings Gift Bundle",
    "Aura Choker Necklaces Selection",
    "Minimalist Stack Rings Retail Batch",
    "Oxidised Silver Bangles Boutique Deal",
    "Custom Gold Plated Solitaire Order",
    "Rose Gold Bridal Necklaces Customization",
    "Turquoise Heritage Charm Bracelet",
    "Limited Edition Cosmic Stardust Studs",
    "Geometric Solas Pendant Proposal"
]

STAGES = ["prospect", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]

def seed_deals():
    print("Checking if deals table exists and fetching customers...")
    
    # 1. Fetch customers
    try:
        cust_resp = supabase.table("customers").select("id").limit(100).execute()
        customers = cust_resp.data if cust_resp.data else []
    except Exception as e:
        print("\n[ERROR] Could not query database. Have you created the 'deals' table yet?", file=sys.stderr)
        print("Please run the raw PostgreSQL CREATE TABLE script in your Supabase SQL Editor first!\n", file=sys.stderr)
        print("Error details:", e, file=sys.stderr)
        sys.exit(1)
        
    if not customers:
        print("[ERROR] No customers found in the database. Please seed the customer database first.")
        sys.exit(1)
        
    print(f"Found {len(customers)} customers. Generating sample deals...")
    
    # 2. Generate sample deals
    deals = []
    customer_ids = [c["id"] for c in customers]
    
    # Ensure we get a good spread of deals across different stages and customers
    random.shuffle(customer_ids)
    
    for i, title in enumerate(DEAL_TITLES):
        c_id = customer_ids[i % len(customer_ids)]
        stage = random.choices(STAGES, weights=[20, 20, 20, 20, 15, 5])[0]
        
        # High value luxury pricing matching the brand vibe
        value = round(random.uniform(120.00, 2450.00), 2)
        
        # Expected close date
        days_offset = random.randint(-5, 60)
        close_date = datetime.now(timezone.utc) + timedelta(days=days_offset)
        
        deals.append({
            "id": str(uuid.uuid4()),
            "customer_id": c_id,
            "title": title,
            "value": value,
            "stage": stage,
            "expected_close_date": close_date.isoformat()
        })
        
    # 3. Insert into deals table
    print(f"Inserting {len(deals)} sample deals into 'deals' table...")
    try:
        response = supabase.table("deals").insert(deals).execute()
        print(f"Successfully seeded {len(response.data)} deals in the Deals Board!")
    except Exception as e:
        print("[ERROR] Failed to insert deals into database:", e, file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    seed_deals()