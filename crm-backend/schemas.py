from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import UUID

# =========================================================================
# CUSTOMER SCHEMAS
# =========================================================================
class CustomerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: EmailStr
    city: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    tags: List[str] = []
    attributes: Dict[str, Any] = {}

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    city: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    tags: Optional[List[str]] = None
    attributes: Optional[Dict[str, Any]] = None
    total_orders: Optional[int] = None
    total_spent: Optional[float] = None
    last_purchase_date: Optional[datetime] = None
    dormancy_status: Optional[str] = None
    rfm_score: Optional[int] = None
    rfm_segment: Optional[str] = None
    churn_risk: Optional[float] = None

class CustomerResponse(CustomerBase):
    id: UUID
    total_orders: int
    total_spent: float
    last_purchase_date: Optional[datetime] = None
    dormancy_status: str
    rfm_score: Optional[int] = None
    rfm_segment: Optional[str] = None
    churn_risk: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# =========================================================================
# PRODUCT SCHEMAS
# =========================================================================
class ProductBase(BaseModel):
    name: str
    category: str
    subcategory: Optional[str] = None
    price: float
    collection_name: Optional[str] = None
    is_limited: bool = False
    tags: List[str] = []
    attributes: Dict[str, Any] = {}

class ProductResponse(ProductBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# =========================================================================
# ORDER SCHEMAS
# =========================================================================
class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int

class OrderBase(BaseModel):
    customer_id: UUID
    items: List[OrderItem]
    order_value: float
    gifting_flag: bool = False
    occasion_tag: Optional[str] = None
    order_channel: str

class OrderResponse(OrderBase):
    id: UUID
    order_date: datetime

    class Config:
        from_attributes = True

# =========================================================================
# SEGMENT SCHEMAS
# =========================================================================
class SegmentFilters(BaseModel):
    city: Optional[str] = Field(None, description="Exact match for city")
    min_spent: Optional[float] = Field(None, ge=0, description="Minimum total spent")
    max_spent: Optional[float] = Field(None, ge=0, description="Maximum total spent")
    min_age: Optional[int] = Field(None, ge=0, description="Minimum customer age")
    max_age: Optional[int] = Field(None, ge=0, description="Maximum customer age")
    gender: Optional[str] = Field(None, description="Exact match for gender")
    rfm_segment: Optional[str] = Field(None, description="Target RFM segment")
    dormancy_status: Optional[str] = Field(None, description="active, warm, dormant, lost, at_risk")
    tags: Optional[List[str]] = Field(default_factory=list, description="Must contain these tags")

    @field_validator('rfm_segment')
    def validate_rfm(cls, v):
        allowed = [
            'Champions', 'Loyal Customers', 'Recent/New', 'Needs Attention', 
            'About to Sleep', 'Hibernating', "Can't Lose Them", 'Lost',
            'Champion', 'Loyal', 'Potential Loyalist', 'At Risk', 'New Customer'
        ]
        if v and v not in allowed:
            raise ValueError(f"Invalid RFM Segment. Must be one of {allowed}")
        return v

    @field_validator('dormancy_status')
    def validate_dormancy(cls, v):
        allowed = ['active', 'warm', 'dormant', 'lost', 'wishlist', 'at_risk']
        if v and v not in allowed:
            raise ValueError(f"Invalid dormancy status. Must be one of {allowed}")
        return v

class SegmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    filter_json: Optional[SegmentFilters] = Field(None, description="Logical rules for filtering customers")
    nl_query: Optional[str] = None

class SegmentCreate(SegmentBase):
    created_by: Optional[UUID] = None

class SegmentResponse(SegmentBase):
    id: UUID
    customer_count: int
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# =========================================================================
# CAMPAIGN SCHEMAS
# =========================================================================
class CampaignBase(BaseModel):
    name: str
    segment_id: Optional[UUID] = None
    channel: str = Field(..., description="email, sms, whatsapp")
    message_template: str
    goal: Optional[str] = None

class CampaignCreate(CampaignBase):
    pass

class CampaignResponse(CampaignBase):
    id: UUID
    status: str
    ai_insight: Optional[str] = None
    total_recipients: int
    sent_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# =========================================================================
# COMMUNICATION SCHEMAS
# =========================================================================
class CommunicationResponse(BaseModel):
    id: UUID
    campaign_id: UUID
    customer_id: UUID
    message_body: str
    channel: str
    status: str
    queued_at: datetime
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    failed_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# =========================================================================
# CAMPAIGN STATS SCHEMAS
# =========================================================================
class CampaignStatsResponse(BaseModel):
    campaign_id: UUID
    total_sent: int
    delivered: int
    failed: int
    opened: int
    read_count: int
    clicked: int
    delivery_rate: float
    open_rate: float
    click_rate: float
    updated_at: datetime

    class Config:
        from_attributes = True

# =========================================================================
# CHANNEL STUB AND WEBHOOK RECEIPT SCHEMAS
# =========================================================================
class ReceiptWebhookPayload(BaseModel):
    communication_id: UUID
    campaign_id: Optional[UUID] = None
    event: str = Field(..., description="delivered, failed, bounced, opened, read, clicked")
    timestamp: datetime
    status: Optional[str] = None # Fallback support
    error_message: Optional[str] = None

# =========================================================================
# AI SCHEMAS (GROK/xAI INTEGRATION)
# =========================================================================
class AITemplateRequest(BaseModel):
    channel: str = Field(..., description="email, sms, whatsapp")
    audience_description: str = Field(..., description="Target segment description or RFM details")
    goal: str = Field(..., description="Goal of the campaign (e.g., winback, product launch, feedback)")
    custom_prompt: Optional[str] = None

class AITemplateResponse(BaseModel):
    generated_templates: List[str]
    ai_insight: str


# =========================================================================
# DEAL SCHEMAS (KANBAN SALES AUTOMATION)
# =========================================================================
class DealBase(BaseModel):
    customer_id: UUID
    title: str
    value: float = Field(..., ge=0)
    stage: str = Field(..., description="prospect, qualified, proposal, negotiation, closed_won, closed_lost")
    expected_close_date: Optional[datetime] = None

class DealCreate(DealBase):
    pass

class DealUpdate(BaseModel):
    title: Optional[str] = None
    value: Optional[float] = Field(None, ge=0)
    stage: Optional[str] = Field(None, description="prospect, qualified, proposal, negotiation, closed_won, closed_lost")
    expected_close_date: Optional[datetime] = None

    @field_validator('stage')
    def validate_stage(cls, v):
        allowed = ['prospect', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']
        if v and v not in allowed:
            raise ValueError(f"Invalid Deal Stage. Must be one of {allowed}")
        return v

class DealResponse(DealBase):
    id: UUID
    customer_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =========================================================================
# TICKET SCHEMAS (SHARED SUPPORT INBOX)
# =========================================================================
class TicketBase(BaseModel):
    customer_id: UUID
    subject: str
    description: str
    status: str = Field(default="open", description="open, pending, resolved")
    priority: str = Field(default="medium", description="low, medium, high, urgent")

    @field_validator('status')
    def validate_status(cls, v):
        allowed = ['open', 'pending', 'resolved']
        if v and v not in allowed:
            raise ValueError(f"Invalid status. Must be one of {allowed}")
        return v

    @field_validator('priority')
    def validate_priority(cls, v):
        allowed = ['low', 'medium', 'high', 'urgent']
        if v and v not in allowed:
            raise ValueError(f"Invalid priority. Must be one of {allowed}")
        return v

class TicketCreate(TicketBase):
    pass

class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None

    @field_validator('status')
    def validate_status(cls, v):
        allowed = ['open', 'pending', 'resolved']
        if v and v not in allowed:
            raise ValueError(f"Invalid status. Must be one of {allowed}")
        return v

    @field_validator('priority')
    def validate_priority(cls, v):
        allowed = ['low', 'medium', 'high', 'urgent']
        if v and v not in allowed:
            raise ValueError(f"Invalid priority. Must be one of {allowed}")
        return v

class TicketResponse(TicketBase):
    id: UUID
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

