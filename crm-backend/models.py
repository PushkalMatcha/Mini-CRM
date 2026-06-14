import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")

# Fallbacks to prevent application crashes during build or initial startup checks
if not SUPABASE_URL:
    SUPABASE_URL = "https://placeholder-project.supabase.co"
if not SUPABASE_KEY:
    SUPABASE_KEY = "placeholder-anon-or-service-key"

# Single connection instance shared across routers
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
