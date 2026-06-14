'''
Created by: Akash Saranathan        
Created on: 04/16/2026  
Modified on: 04/27/2026
Purpose: This module implements guardrails for an AI agent, providing both input and output safety checks. 
         The input guardrails include profanity filtering, harmful intent detection, prompt injection prevention, and sensitive data detection. 
         The output guardrails ensure that the AI's responses are free from profanity, do not contain sensitive information, and are of a reasonable length.
How to run: Run the script: `nemo_guard.py`

'''
import re
from nemoguardrails import LLMRails, RailsConfig
import os
from dotenv import load_dotenv

# ---------------------------
# Risk scoring system
# ---------------------------
def calculate_risk(text: str) -> int:
    score = 0
    text_lower = text.lower()

    # Injection attempts
    injection_patterns = [
        r"system prompt",
        r"ignore instructions",
        r"bypass",
        r"jailbreak"
    ]

    for p in injection_patterns:
        if re.search(p, text_lower):
            score += 3

    # Sensitive data
    if re.search(r"\b\d{3}-\d{2}-\d{4}\b", text):
        score += 4  # SSN

    if re.search(r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b", text):
        score += 3  # email

    if re.search(r"\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", text):
        score += 3  # phone

    # Harmful intent
    if any(w in text_lower for w in ["kill", "attack", "bomb"]):
        score += 3

    return score


# ---------------------------
# Decision engine (NeMo action)
# ---------------------------
async def action_safety_router(context=None):
    text = context.get("last_user_message", "")
    risk = calculate_risk(text)

    if risk >= 6:
        return "block"
    elif risk >= 3:
        return "warn"
    else:
        return "allow"
    


load_dotenv()

os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY", "")
# config = RailsConfig.from_path("guardrails")
config = RailsConfig.from_path("./config")
rails = LLMRails(config)

# register your action
rails.register_action(action_safety_router, name="action_safety_router")