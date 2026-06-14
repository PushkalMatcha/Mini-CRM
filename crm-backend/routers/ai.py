import os
import json
import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from openai import AsyncOpenAI
from routers.segments import evaluate_segment_rules, local_regex_compile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Integration"])

# Grok / xAI Integration settings
XAI_API_KEY = os.environ.get("XAI_API_KEY") or os.environ.get("GROK_API_KEY")
XAI_BASE_URL = os.environ.get("XAI_BASE_URL", "https://api.x.ai/v1")
XAI_MODEL = os.environ.get("XAI_MODEL", "grok-beta")

# Initialize OpenAI SDK pointing to Grok
openai_client = AsyncOpenAI(
    api_key=XAI_API_KEY or "dummy-key",
    base_url=XAI_BASE_URL
)

# =========================================================================
# SCHEMAS DEFINITION
# =========================================================================

class AITemplateRequest(BaseModel):
    channel: str
    audience_description: str
    goal: str

class AITemplateResponse(BaseModel):
    generated_templates: List[str]
    ai_insight: str

class AIChatMessage(BaseModel):
    role: str  # 'user', 'assistant', 'system'
    content: str

class AIChatRequest(BaseModel):
    message: str
    chat_history: Optional[List[AIChatMessage]] = []

class SegmentResponse(BaseModel):
    name: str
    filter_json: Dict[str, Any]
    customer_count: int = 0

class ChannelResponse(BaseModel):
    name: str
    reason: str

class AIChatResponse(BaseModel):
    reply: str
    segment: Optional[SegmentResponse] = None
    messages: Optional[List[str]] = None
    channel: Optional[ChannelResponse] = None

# =========================================================================
# CHAT SYSTEM PROMPT
# =========================================================================

SYSTEM_PROMPT = """
You are Maeven CRM Assistant, an expert AI copilot for Maeven, a premium handcrafted jewelry brand.
Analyze the user's natural language request to create a target customer segment, recommended messaging channel, and tailored marketing copy.

You MUST respond strictly in the following JSON format:
{
    "reply": "Conversational confirmation of the task (1-2 sentences in a warm, luxury-themed, concise tone)",
    "segment": {
        "name": "Generated segment name",
        "filter_json": {
             ...logical database filters compiled from the user query...
        }
    },
    "messages": [
        "Draft 1 (under 160 characters, matching Maeven's premium aesthetic, using {{name}} placeholder)",
        "Draft 2 (under 160 characters, matching Maeven's premium aesthetic, using {{name}} placeholder)"
    ],
    "channel": {
        "name": "whatsapp" or "sms" or "email",
        "reason": "Why this channel was chosen for this campaign/audience?"
    }
}

Allowed keys inside filter_json:
- "city": string (exact match, e.g. "Mumbai", "Goa")
- "rfm_segment": string (Champions, Loyal Customers, Recent/New, About to Sleep, Hibernating, Lost)
- "dormancy_status": string (active, at_risk, dormant)
- "gender": string (Female, Male, Non-binary)
- "min_spent": number (total spent greater than or equal to, e.g., 500)
- "max_spent": number (total spent less than or equal to)
- "min_age": integer (age greater than or equal to)
- "max_age": integer (age less than or equal to)
- "tags": array of strings (e.g. ["vip", "festive-shopper"])

If a field is not specified in the user request, do not include it in filter_json.
If the user is asking a general question or not defining a segment/campaign request, set "segment", "messages", and "channel" to null, and write your conversational answer in "reply".
Return ONLY valid JSON. Do not include markdown codeblocks (```json or ```), comments, or extra whitespace.
"""

# =========================================================================
# CHAT ENDPOINT
# =========================================================================

@router.post("/chat", response_model=AIChatResponse)
async def ai_chat_composer(payload: AIChatRequest):
    """
    Main conversational agent endpoint.
    Processes user input using OpenAI SDK (Grok API), parses JSON schema output,
    and returns a structured response to the frontend.
    """
    query = payload.message
    
    if not XAI_API_KEY:
        logger.warning("XAI_API_KEY not configured. Falling back to local mock chat assistant.")
        return run_mock_chat_assistant(query)

    # Compile messages with system prompt
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in payload.chat_history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": query})

    try:
        response = await openai_client.chat.completions.create(
            model=XAI_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.5,
            timeout=15.0
        )
        
        content_str = response.choices[0].message.content
        if not content_str:
            raise ValueError("Empty completion response from Grok.")

        parsed_content = json.loads(content_str)
        
        reply = parsed_content.get("reply", "Certainly. I compiled the campaign request.")
        segment_data = parsed_content.get("segment")
        messages_data = parsed_content.get("messages")
        channel_data = parsed_content.get("channel")

        # Parse and count matching customers for the segment
        segment_obj = None
        if isinstance(segment_data, dict) and "filter_json" in segment_data:
            name = segment_data.get("name", "AI Segment")
            filters = segment_data.get("filter_json", {})
            if isinstance(filters, dict):
                count = evaluate_segment_rules(filters)
                segment_obj = SegmentResponse(
                    name=name,
                    filter_json=filters,
                    customer_count=count
                )

        channel_obj = None
        if isinstance(channel_data, dict) and "name" in channel_data:
            c_name = channel_data.get("name", "email").lower()
            if c_name not in ["whatsapp", "sms", "email"]:
                c_name = "email"
            channel_obj = ChannelResponse(
                name=c_name,
                reason=channel_data.get("reason", "Preferred campaign channel.")
            )

        return AIChatResponse(
            reply=reply,
            segment=segment_obj,
            messages=messages_data if isinstance(messages_data, list) else None,
            channel=channel_obj
        )

    except Exception as e:
        logger.error(f"Error calling Grok completion API: {e}")
        return run_mock_chat_assistant(query)

# =========================================================================
# TEMPLATE GENERATOR ENDPOINT
# =========================================================================

@router.post("/generate-templates", response_model=AITemplateResponse)
async def generate_templates(payload: AITemplateRequest):
    """
    Generate message template variations using OpenAI SDK pointing to Grok.
    """
    prompt = f"""
    You are an expert copywriter for Maeven, a premium handcrafted jewelry brand.
    Write 3 highly engaging message template variations for a marketing campaign.
    Channel: {payload.channel}
    Target Audience Description: {payload.audience_description}
    Campaign Goal: {payload.goal}
    
    CRITICAL: 
    - The templates must be tailored to the channel (e.g. short and punchy for SMS/WhatsApp, subject lines for Email).
    - Always use the placeholder '{{{{name}}}}' for the customer's name.
    - Return your response strictly in JSON format matching the schema requested.
    
    Return your response strictly in the following JSON format:
    {{
        "generated_templates": [
            "Variation 1 template copy",
            "Variation 2 template copy",
            "Variation 3 template copy"
        ],
        "ai_insight": "Short insight text here."
    }}
    """
    
    if not XAI_API_KEY:
        logger.warning("XAI_API_KEY not configured. Falling back to mock templates.")
        return get_mock_templates(payload)

    try:
        response = await openai_client.chat.completions.create(
            model=XAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a professional retail marketing assistant that replies strictly in JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            timeout=12.0
        )
        content_str = response.choices[0].message.content
        if not content_str:
            raise ValueError("Empty response.")
            
        parsed_content = json.loads(content_str)
        return AITemplateResponse(
            generated_templates=parsed_content.get("generated_templates", []),
            ai_insight=parsed_content.get("ai_insight", "Optimized templates for engagement.")
        )
    except Exception as e:
        logger.error(f"Error generating copywriting templates: {e}")
        return get_mock_templates(payload)

# =========================================================================
# MOCK FALLBACKS
# =========================================================================

def new_segment_name_helper(filters: dict) -> str:
    parts = []
    if "city" in filters:
        parts.append(filters["city"])
    if "rfm_segment" in filters:
        parts.append(filters["rfm_segment"])
    if "dormancy_status" in filters:
        parts.append(filters["dormancy_status"].capitalize())
    if "min_spent" in filters:
        parts.append(f"Spent >={filters['min_spent']}")
    return " & ".join(parts) if parts else "All Customers"

def run_mock_chat_assistant(query: str) -> AIChatResponse:
    """
    Fallback chat compiler using local keyword analysis and database rules evaluation.
    Matches the schema requirements.
    """
    query_lower = query.lower()
    filters = local_regex_compile(query)
    count = evaluate_segment_rules(filters)
    
    # 1. Segment/Campaign Intent
    if any(k in query_lower for k in ["show", "find", "count", "segment", "filter", "who", "active", "spent", "mumbai", "goa", "delhi", "bangalore"]):
        segment_name = f"Segment - {new_segment_name_helper(filters)}"
        
        # Determine recommended channel
        c_name = "whatsapp"
        reason = "WhatsApp features an 88% higher response rates for instant promo stack offers compared to SMS."
        if "email" in query_lower:
            c_name = "email"
            reason = "Email is the standard channel for high-retention newsletter lists."
        elif "sms" in query_lower:
            c_name = "sms"
            reason = "SMS is highly direct and is optimal for urgent winback promotions."
            
        drafts = [
            "Hi {{name}} ✨. Add a bold edge to your style with our handcrafted silver collections. Shop now: [Link]",
            "Hello {{name}}, enjoy an exclusive 15% discount on our sterling rings stack today. Code: GLOW15 [Link]"
        ]
        
        return AIChatResponse(
            reply=f"I compiled your segment logic. I searched the customer database and found **{count}** matching profiles. Here are my recommendations.",
            segment=SegmentResponse(
                name=segment_name,
                filter_json=filters,
                customer_count=count
            ),
            messages=drafts,
            channel=ChannelResponse(
                name=c_name,
                reason=reason
            )
        )
        
    # 2. General Conversational Intent
    else:
        return AIChatResponse(
            reply="Hello! I am your Maeven CRM Assistant. Ask me to find customer groups (e.g. 'find active customers in Mumbai who spent over 400') or generate copywriting variations.",
            segment=None,
            messages=None,
            channel=None
        )

def get_mock_templates(payload: AITemplateRequest) -> AITemplateResponse:
    """
    Mock templates generator for local testing.
    """
    channel = payload.channel.lower()
    goal = payload.goal.lower()
    
    if channel == "email":
        if "winback" in goal or "inactive" in goal or "dormant" in goal:
            templates = [
                "Subject: We miss you, {{name}} ✨ | A special gift inside\n\nHi {{name}},\n\nIt's been a while since your last Maeven purchase. To welcome you back, we've unlocked an exclusive 15% discount code just for you: WELCOMEBACK15.\n\nWarmly,\nThe Maeven Team",
                "Subject: {{name}}, is your jewelry box ready for a refresh? 💍\n\nHello {{name}},\n\nSince you last visited, we've dropped our new 'Oxidised Heritage' line—handcrafted pieces that add a bold edge to everyday style.\n\nEnjoy complimentary shipping with code MAEVENFREE.",
                "Subject: A handcrafted token of appreciation for {{name}}\n\nDear {{name}},\n\nWe love seeing you shine in Maeven. Claim early access to our limited-edition summer pendants here: [Link]"
            ]
            insight = "Dormant customers respond best to warm, value-driven subject lines combined with direct incentives like discount codes."
        else:
            templates = [
                "Subject: Curated handcrafted elegance for {{name}} 🌸\n\nHi {{name}},\n\nAdd a touch of nature to your look with our new 'Floral Bloom' collection. Browse details: [Link]",
                "Subject: {{name}}, stack and layer your look\n\nHello {{name}},\n\nMix, match, and stack. Our minimalist silver bands are designed to be worn together. Code: STACK10.",
                "Subject: Statement pieces you've been waiting for, {{name}}\n\nDear {{name}},\n\nOur latest drop is here. Bold oxidised designs made to stand out. Limited quantities available: [Link]"
            ]
            insight = "Product collections highlighting specific styles show a 22% higher click rate."
    else:
        if "winback" in goal or "inactive" in goal or "dormant" in goal:
            templates = [
                "Hey {{name}}, we miss your style! ✨ Enjoy 15% off your next Maeven jewelry purchase. Use code BACK15 at checkout: [Link]",
                "Hello {{name}}, it's been a while. Rediscover Maeven's handcrafted minimalist silver rings with a special free shipping gift. Code: SHIPFREE [Link]",
                "Hey {{name}}, ready to shine again? 💍 The new Celestial collection is live. Grab yours with an exclusive loyalty reward: [Link]"
            ]
            insight = "Short messages with quick-action links work best for instant messaging channels."
        else:
            templates = [
                "Hi {{name}}! 🌸 Elevate your look with Maeven's new handcrafted 'Floral Bloom' collection. Shop here: [Link]",
                "Hey {{name}}, make a statement. Our limited-edition Oxidised Silver Jhumkas are back in stock! Shop: [Link]",
                "Hi {{name}}, layer up! Get 10% off our minimalist stacking rings today with code STACK10: [Link]"
            ]
            insight = "For instant messaging, emphasizing scarcity ('limited-edition') drives immediate click actions."

    return AITemplateResponse(
        generated_templates=templates,
        ai_insight=insight
    )
