import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Import routers
from routers.customers import router as customers_router
from routers.segments import router as segments_router
from routers.campaigns import router as campaigns_router
from routers.receipt import router as receipt_router
from routers.ai import router as ai_router
from routers.deals import router as deals_router
from routers.tickets import router as tickets_router
from routers.webhooks import router as webhooks_router

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Maeven CRM API",
    description="Production-grade CRM platform backend engine for retail & D2C brands, featuring Grok-powered AI tools.",
    version="1.0.0"
)

# Read allowed origin from env, default to localhost for dev
FRONTEND_URL = os.getenv("NEXT_PUBLIC_FRONTEND_URL", "http://localhost:3000")

# Configure CORS Middleware
# Allows seamless communication between the Next.js client and local backend server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL], # Removed the wildcard ["*"]
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Register routers
app.include_router(customers_router)
app.include_router(customers_router, prefix="/api")

app.include_router(segments_router)
app.include_router(segments_router, prefix="/api")

app.include_router(campaigns_router)
app.include_router(campaigns_router, prefix="/api")

app.include_router(receipt_router)
app.include_router(receipt_router, prefix="/api")

app.include_router(ai_router)
app.include_router(ai_router, prefix="/api")

app.include_router(deals_router)
app.include_router(deals_router, prefix="/api")

app.include_router(tickets_router)
app.include_router(tickets_router, prefix="/api")

app.include_router(webhooks_router)
app.include_router(webhooks_router, prefix="/api")

@app.get("/")
async def get_root_status():
    """
    Service health and description endpoint.
    """
    return {
        "service": "Maeven CRM API Engine",
        "status": "healthy",
        "version": "1.0.0",
        "endpoints": {
            "customers": "/customers",
            "segments": "/segments",
            "campaigns": "/campaigns",
            "receipt": "/receipt",
            "ai": "/ai"
        }
    }

if __name__ == "__main__":
    logger.info("Starting Maeven CRM Backend Engine...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
