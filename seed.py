import os
import random
import uuid
import logging
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from faker import Faker
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
# Service role key is preferred to bypass RLS during seeding
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Error: SUPABASE_URL and SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY environment variables must be set.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
fake = Faker()

# Reference date for RFM calculation (matching current local time context in 2026)
CURRENT_DATE = datetime(2026, 6, 12, tzinfo=timezone.utc)

# -----------------------------------------------------------------------------
# PRODUCT DATA DEFINITION (Maeven Jewelry Vibe)
# -----------------------------------------------------------------------------
COLLECTIONS = ["Floral Bloom", "Oxidised Heritage", "Minimalist Chic", "Cosmic Stardust", "Royal Heritage"]
CATEGORIES = {
    "Necklaces": ["Choker", "Pendant", "Lariat", "Collar"],
    "Rings": ["Solitaire", "Band", "Stackable", "Cocktail"],
    "Earrings": ["Studs", "Hoops", "Jhumkas", "Drop Earrings"],
    "Bracelets": ["Cuff", "Charm Bracelet", "Bangle", "Chain Link"]
}

MATERIALS = ["Sterling Silver", "18K Gold Plated", "Oxidised Brass", "Rose Gold"]
GEMSTONES = ["Pearls", "Turquoise", "Emerald", "Ruby", "Cubic Zirconia", "None"]

JEWELRY_TAGS = [
    "minimalist", "floral", "oxidised", "heritage", "bohemian", 
    "bridal", "contemporary", "vintage", "handcrafted", "geometric"
]

def generate_products():
    random.seed(42)
    products = []
    # Generate 40 unique products
    for i in range(40):
        category = random.choice(list(CATEGORIES.keys()))
        subcategory = random.choice(CATEGORIES[category])
        collection = random.choice(COLLECTIONS)
        material = random.choice(MATERIALS)
        gemstone = random.choice(GEMSTONES)
        
        # Craft a premium jewelry name
        adjective = random.choice(["Aura", "Luna", "Celestia", "Siren", "Meadow", "Solas", "Gilded", "Iris", "Elysian", "Zuri"])
        product_name = f"{adjective} {subcategory}"
        
        # Tags selection
        tags = list(set([random.choice(JEWELRY_TAGS), category.lower(), subcategory.lower().replace(" ", "_")]))
        
        # Price range depending on material
        if "Gold" in material:
            price = round(random.uniform(150.00, 499.00), 2)
        elif "Silver" in material:
            price = round(random.uniform(60.00, 199.00), 2)
        else:
            price = round(random.uniform(25.00, 89.00), 2)
            
        attributes = {
            "material": material,
            "gemstone": gemstone,
            "weight_grams": round(random.uniform(1.5, 15.0), 1),
            "size": "Adjustable" if category in ["Rings", "Bracelets"] else "Standard"
        }
        
        products.append({
            "id": str(uuid.uuid4()),
            "name": product_name,
            "category": category,
            "subcategory": subcategory,
            "price": price,
            "collection_name": collection,
            "is_limited": random.random() < 0.15, # 15% limited items
            "tags": tags,
            "attributes": attributes
        })
    return products

# -----------------------------------------------------------------------------
# CUSTOMER DATA DEFINITION
# -----------------------------------------------------------------------------
CITIES = ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Jaipur", "Ahmedabad", "Goa"]
GENDERS = ["Female", "Male", "Non-binary", "Prefer not to say"]
CUSTOMER_TAGS = ["high-intent", "first-time", "gifting-heavy", "festive-shopper", "newsletter-subscriber", "vip", "abandoned-cart"]

def generate_customers(count=500):
    random.seed(42)
    fake.seed_instance(42)
    customers = []
    for _ in range(count):
        gender = random.choices(GENDERS, weights=[65, 20, 10, 5])[0]
        first_name = fake.first_name_female() if gender == "Female" else fake.first_name()
        last_name = fake.last_name()
        name = f"{first_name} {last_name}"
        email = f"{first_name.lower()}.{last_name.lower()}{random.randint(10, 99)}@{fake.free_email_domain()}"
        phone = f"+91{random.randint(7000000000, 9999999999)}"
        
        # Customer attributes
        attributes = {
            "preferred_category": random.choice(list(CATEGORIES.keys())),
            "preferred_material": random.choice(MATERIALS),
            "birthdate": fake.date_of_birth(minimum_age=18, maximum_age=65).isoformat()
        }
        
        # Select 1-3 customer tags
        tags = random.sample(CUSTOMER_TAGS, random.randint(1, 3))
        
        customers.append({
            "id": str(uuid.uuid4()),
            "name": name,
            "phone": phone,
            "email": email,
            "city": random.choice(CITIES),
            "age": random.randint(18, 65),
            "gender": gender,
            "tags": tags,
            "attributes": attributes,
            "total_orders": 0,
            "total_spent": 0.00,
            "last_purchase_date": None,
            "rfm_score": None,
            "rfm_segment": None,
            "churn_risk": 0.00,
            "dormancy_status": "active"
        })
    return customers

# -----------------------------------------------------------------------------
# ORDER SIMULATION
# -----------------------------------------------------------------------------
OCCASIONS = ["Birthday", "Anniversary", "Festive Season", "Self-Gift", "None"]
CHANNELS = ["website", "retail_store", "instagram", "whatsapp"]

def simulate_orders(customers, products, order_count=1850):
    random.seed(42)
    orders = []
    # Ensure every customer gets at least 1 order to make data robust, then distribute remaining randomly
    customer_ids = [c["id"] for c in customers]
    
    # Track order lists per customer to aggregate calculations
    customer_orders = {c["id"]: [] for c in customers}
    
    # Generate orders
    for i in range(order_count):
        # First 500 orders go to each customer to guarantee no empty customers, then distribute randomly
        if i < len(customers):
            c_id = customers[i]["id"]
        else:
            c_id = random.choice(customer_ids)
            
        # Select 1-3 random items
        num_items = random.choices([1, 2, 3], weights=[70, 20, 10])[0]
        selected_products = random.sample(products, num_items)
        
        items_json = []
        order_value = 0.00
        
        for p in selected_products:
            qty = random.choices([1, 2], weights=[90, 10])[0]
            price = p["price"]
            items_json.append({
                "product_id": p["id"],
                "name": p["name"],
                "price": float(price),
                "quantity": qty
            })
            order_value += float(price) * qty
            
        order_value = round(order_value, 2)
        
        # Order date: distributed over the last 2 years (730 days)
        days_ago = random.randint(1, 730)
        order_date = CURRENT_DATE - timedelta(days=days_ago)
        
        orders.append({
            "id": str(uuid.uuid4()),
            "customer_id": c_id,
            "items": items_json,
            "order_value": order_value,
            "gifting_flag": random.random() < 0.20, # 20% gifting
            "occasion_tag": random.choices(OCCASIONS, weights=[30, 20, 15, 25, 10])[0],
            "order_channel": random.choices(CHANNELS, weights=[70, 15, 10, 5])[0],
            "order_date": order_date.isoformat()
        })
        
        customer_orders[c_id].append((order_value, order_date))
        
    # Recalculate customer metrics based on simulation
    for c in customers:
        orders_list = customer_orders[c["id"]]
        if not orders_list:
            continue
            
        c["total_orders"] = len(orders_list)
        c["total_spent"] = round(sum(o[0] for o in orders_list), 2)
        
        # Find latest purchase date
        latest_date = max(o[1] for o in orders_list)
        c["last_purchase_date"] = latest_date.isoformat()
        
        # Calculate RFM Scores
        # 1. Recency Score (based on days since last purchase)
        days_since_purchase = (CURRENT_DATE - latest_date).days
        if days_since_purchase < 45:
            recency = 5
        elif days_since_purchase < 120:
            recency = 4
        elif days_since_purchase < 240:
            recency = 3
        elif days_since_purchase < 450:
            recency = 2
        else:
            recency = 1
            
        # 2. Frequency Score (based on total order count)
        order_count = c["total_orders"]
        if order_count >= 6:
            frequency = 5
        elif order_count >= 4:
            frequency = 4
        elif order_count >= 3:
            frequency = 3
        elif order_count >= 2:
            frequency = 2
        else:
            frequency = 1
            
        # 3. Monetary Score (based on total spent)
        spent = c["total_spent"]
        if spent >= 1200.00:
            monetary = 5
        elif spent >= 600.00:
            monetary = 4
        elif spent >= 300.00:
            monetary = 3
        elif spent >= 150.00:
            monetary = 2
        else:
            monetary = 1
            
        c["rfm_score"] = recency * 100 + frequency * 10 + monetary
        
        # Determine Segment
        if recency >= 4 and frequency >= 4 and monetary >= 4:
            c["rfm_segment"] = "Champions"
        elif recency >= 3 and frequency >= 3 and monetary >= 3:
            c["rfm_segment"] = "Loyal Customers"
        elif recency >= 4 and frequency <= 2:
            c["rfm_segment"] = "Recent/New"
        elif recency == 3 and frequency <= 2:
            c["rfm_segment"] = "Needs Attention"
        elif recency == 2 and frequency >= 3:
            c["rfm_segment"] = "About to Sleep"
        elif recency == 2 and frequency <= 2:
            c["rfm_segment"] = "Hibernating"
        elif recency == 1 and frequency >= 3:
            c["rfm_segment"] = "Can't Lose Them"
        else:
            c["rfm_segment"] = "Lost"
            
        # Dormancy Status & Churn Risk
        if recency >= 4:
            c["dormancy_status"] = "active"
            c["churn_risk"] = round(random.uniform(5.00, 25.00), 2)
        elif recency >= 2:
            c["dormancy_status"] = "at_risk"
            c["churn_risk"] = round(random.uniform(25.00, 65.00), 2)
        else:
            c["dormancy_status"] = "dormant"
            c["churn_risk"] = round(random.uniform(65.00, 98.00), 2)
            
    return orders

# -----------------------------------------------------------------------------
# DATABASE SEED WRITER
# -----------------------------------------------------------------------------
def run_seeding():
    logger.info("Initializing Maeven CRM seeding simulation...")
    
    # 1. Generate core data models in memory
    products = generate_products()
    logger.info(f"Generated {len(products)} products in memory.")
    
    customers = generate_customers(500)
    logger.info(f"Generated {len(customers)} customers in memory.")
    
    orders = simulate_orders(customers, products, 1850)
    logger.info(f"Generated {len(orders)} order events. Calculated self-consistent RFM segments.")
    
    # 2. Clear old data (Optional but recommended for safe seed restarts)
    # RLS might block delete unless using service_role, handled via cascading or direct commands.
    logger.info("Clearing existing tables in Supabase (if any)...")
    try:
        # Delete orders first because they reference customers
        supabase.table("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        supabase.table("customers").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        supabase.table("products").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        logger.info("Database cleared.")
    except Exception as e:
        logger.warning(f"Failed to clear existing tables (RSL or schema mismatch): {e}")

    # 3. Bulk insert products
    logger.info("Inserting products...")
    try:
        supabase.table("products").insert(products).execute()
        logger.info("Successfully seeded products table.")
    except Exception as e:
        logger.error(f"Error seeding products: {e}")
        return

    # 4. Bulk insert customers
    logger.info("Inserting customers...")
    # Insert in chunks of 100 to avoid request body size limits
    chunk_size = 100
    for i in range(0, len(customers), chunk_size):
        chunk = customers[i:i + chunk_size]
        try:
            supabase.table("customers").insert(chunk).execute()
        except Exception as e:
            logger.error(f"Error seeding customers chunk {i}-{i+chunk_size}: {e}")
            return
    logger.info("Successfully seeded customers table.")

    # 5. Bulk insert orders
    logger.info("Inserting orders...")
    for i in range(0, len(orders), chunk_size):
        chunk = orders[i:i + chunk_size]
        try:
            supabase.table("orders").insert(chunk).execute()
        except Exception as e:
            logger.error(f"Error seeding orders chunk {i}-{i+chunk_size}: {e}")
            return
    logger.info("Successfully seeded orders table.")
    
    logger.info(" maeve CRM Database seeding completed successfully! ")

if __name__ == "__main__":
    run_seeding()
