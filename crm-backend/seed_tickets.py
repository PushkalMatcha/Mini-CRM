import random
import uuid
import sys
from datetime import datetime, timedelta, timezone
from models import supabase

TICKET_SUBJECTS = [
    ("Aura Choker Necklaces Resizing Request", "Hi support team, I recently purchased the Aura Choker Necklace for my anniversary. The length is slightly too tight for me. Can I request a size extension or custom adjustment? Please advise on the return shipment procedure. Thanks!"),
    ("Celestia Pendant Custom Engraving Query", "Hello, I would like to order the Celestia Pendant as a birthday gift for my daughter. I want to know if it is possible to engrave a short message 'Always with love' on the reverse side of the pendant? Let me know if there are extra fees. Best, Emily."),
    ("Delivery Delay - Festive Order Tracking", "Hello, my order (Luna Stackable Band Set) has been marked in transit for 5 days. I need it by this Friday for a wedding function. Can you please check the carrier tracking status or speed it up? Customer ID email is matched."),
    ("Aura Studs Material Care & Tarnishing", "Dear support, I received my Rose Gold plated Aura Studs last week. They are absolutely stunning, but I noticed a slight discoloration on the posts after wearing them once. How should I care for them to prevent further tarnishing?"),
    ("Double Billing on Elysian Solitaire Order", "Urgent: I placed an order for the Elysian Diamond Solitaire Ring, and my credit card was charged twice for the transaction. Please review the payment records and refund the duplicate payment of $1450.00 as soon as possible."),
    ("Luna Bangle Boutique Customization", "Hi, we are interested in ordering 10 units of the Luna Bangle for our boutique staff. We wanted to customize the material to Sterling Silver but with a matte finish. Could you send us a wholesale quote? Thank you, Boutique Owner."),
    ("Heritage Jhumkas Ring Box Replacement", "Hello Maeven, the jewelry box containing my Heritage Jhumkas collection order arrived slightly crushed during shipping. Since this is a gift for my sister, could you please send a replacement empty luxury box? Thank you!")
]

STATUSES = ["open", "pending", "resolved"]
PRIORITIES = ["low", "medium", "high", "urgent"]

def seed_tickets():
    print("Checking if tickets table exists and fetching customers...")
    
    # 1. Fetch customers
    try:
        cust_resp = supabase.table("customers").select("id").limit(100).execute()
        customers = cust_resp.data if cust_resp.data else []
    except Exception as e:
        print("\n[ERROR] Could not query database. Have you created the 'tickets' table yet?", file=sys.stderr)
        print("Please run the raw PostgreSQL CREATE TABLE script in your Supabase SQL Editor first!\n", file=sys.stderr)
        print("Error details:", e, file=sys.stderr)
        sys.exit(1)
        
    if not customers:
        print("[ERROR] No customers found in the database. Please seed the customer database first.")
        sys.exit(1)
        
    print(f"Found {len(customers)} customers. Generating support tickets...")
    
    # 2. Generate support tickets
    tickets = []
    customer_ids = [c["id"] for c in customers]
    random.shuffle(customer_ids)
    
    for i, (subj, desc) in enumerate(TICKET_SUBJECTS):
        c_id = customer_ids[i % len(customer_ids)]
        status = random.choices(STATUSES, weights=[40, 40, 20])[0]
        # map subjects like double billing to urgent/high
        if "Double Billing" in subj or "Urgent" in subj:
            priority = "urgent"
        elif "Delay" in subj:
            priority = "high"
        else:
            priority = random.choices(PRIORITIES, weights=[40, 30, 20, 10])[0]
            
        days_offset = random.randint(-10, 0)
        created_time = datetime.now(timezone.utc) + timedelta(days=days_offset)
        
        tickets.append({
            "id": str(uuid.uuid4()),
            "customer_id": c_id,
            "subject": subj,
            "description": desc,
            "status": status,
            "priority": priority,
            "created_at": created_time.isoformat(),
            "updated_at": created_time.isoformat()
        })
        
    # 3. Insert into tickets table
    print(f"Inserting {len(tickets)} sample tickets into 'tickets' table...")
    try:
        response = supabase.table("tickets").insert(tickets).execute()
        print(f"Successfully seeded {len(response.data)} tickets in the support Shared Inbox!")
    except Exception as e:
        print("[ERROR] Failed to insert tickets into database:", e, file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    seed_tickets()