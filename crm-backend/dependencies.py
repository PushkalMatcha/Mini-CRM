import os
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from models import supabase

logger = logging.getLogger(__name__)

# auto_error=False allows the request to proceed if Authorization header is missing,
# letting verify_session implement custom soft enforcement logic.
security = HTTPBearer(auto_error=False)

# Strict auth enforcement setting (default to false for soft enforcement in demo environments)
STRICT_AUTH = os.getenv("STRICT_AUTH", "false").lower() == "true"

def verify_session(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Verifies the JWT token passed from the Next.js frontend via Supabase.
    Supports soft enforcement: logs a warning and returns a mock user if strict check is disabled.
    """
    if not credentials:
        if STRICT_AUTH:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication credentials are required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        logger.warning("Authentication token missing - Bypassed due to soft enforcement (STRICT_AUTH=false).")
        return {"id": "mock-demo-user", "email": "demo@maeven.com"}

    token = credentials.credentials
    try:
        # Fetch user details from Supabase using the JWT token
        res = supabase.auth.get_user(token)
        if not res or not res.user:
            raise ValueError("Invalid user token metadata")
        return res.user
    except Exception as e:
        if STRICT_AUTH:
            logger.error(f"Authentication verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        logger.warning(f"Authentication verification failed ({e}) - Bypassed due to soft enforcement (STRICT_AUTH=false).")
        return {"id": "mock-demo-user", "email": "demo@maeven.com"}
