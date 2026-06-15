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


# =========================================================================
# RATE LIMITER DEPENDENCY
# =========================================================================
from time import time
from collections import defaultdict
from fastapi import Request

class RateLimiter:
    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        # Maps client_ip to list of request timestamps
        self.history = defaultdict(list)

    def __call__(self, request: Request):
        # Resolve client IP (fall back to a placeholder if none)
        client_ip = request.client.host if request.client else "unknown_ip"
        now = time()
        
        # Clean up history older than window_seconds
        self.history[client_ip] = [t for t in self.history[client_ip] if now - t < self.window_seconds]
        
        # Check limit
        if len(self.history[client_ip]) >= self.requests_limit:
            logger.warning(f"Rate limit exceeded for client {client_ip} on path {request.url.path}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Please try again after {self.window_seconds} seconds."
            )
            
        # Add current timestamp
        self.history[client_ip].append(now)

