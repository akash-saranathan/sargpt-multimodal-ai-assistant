'''
Created by: Akash Saranathan        
Created on: 04/14/2026  
Modified on: 04/27/2026
Purpose: This module implements guardrails for an AI agent, providing both input and output safety checks. 
         The input guardrails include profanity filtering, harmful intent detection, prompt injection prevention, and sensitive data detection. 
         The output guardrails ensure that the AI's responses are free from profanity, do not contain sensitive information, and are of a reasonable length.
How to run: 1. Install dependencies: `pip install better_profanity nemoguardrails`
             2. Set your OpenAI API key in a .env file: `OPENAI_API_KEY=your_api_key_here`
             3. Run the script: `python guardrails.py`

'''

import re
from better_profanity import profanity


profanity.load_censor_words()

# Cap after profanity/PII handling (prevents runaway responses; must be large enough for normal answers)
MAX_ASSISTANT_OUTPUT_CHARS = 12000

# ---------------------------
# 🔧 Normalization (anti-bypass)
# ---------------------------
def normalize_text(text: str):
    return (
        text.lower()
        .replace("0", "o")
        .replace("1", "i")
        .replace("3", "e")
        .replace("@", "a")
    )

# ---------------------------
# Keyword Blocking
# ---------------------------
BANNED_KEYWORDS = ["kill", "attack", "bomb"]

PROMPT_INJECTION_PATTERNS = [
    r"system prompt",
    r"ignore instructions",
    r"bypass",
    r"admin",
    r"password"
]

# ---------------------------
# Sensitive Data Patterns
# ---------------------------
SENSITIVE_PATTERNS = {
    "SSN": r"\b\d{3}-\d{2}-\d{4}\b",
    "PHONE": r"\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
    "EMAIL": r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b",
    "CREDIT_CARD": r"\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b"
}

# ---------------------------
# INPUT GUARDRAIL
# ---------------------------
def check_input_safety(text: str):
    normalized = normalize_text(text)

    # 1. Profanity
    if profanity.contains_profanity(text):
        return False, "Please avoid using inappropriate language."

    # 2. Harmful intent
    for word in BANNED_KEYWORDS:
        if word in normalized:
            return False, "Unsafe query detected. I cannot assist with that."

    # 3. Prompt injection
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            return False, "Suspicious input detected. Request blocked."

    # 4. Sensitive data detection
    for label, pattern in SENSITIVE_PATTERNS.items():
        if re.search(pattern, text):
            return False, f"Sharing sensitive information ({label}) is not allowed."

    return True, ""


# ---------------------------
# OUTPUT GUARDRAIL
# ---------------------------
def check_output_safety(text: str):
    # 1. Censor profanity
    clean_text = profanity.censor(text)

    # 2. Mask sensitive data in output
    for pattern in SENSITIVE_PATTERNS.values():
        clean_text = re.sub(pattern, "[REDACTED]", clean_text)

    # 3. Limit response size
    if len(clean_text) > MAX_ASSISTANT_OUTPUT_CHARS:
        clean_text = clean_text[:MAX_ASSISTANT_OUTPUT_CHARS] + "..."

    return clean_text



def advanced_output_safety(text: str):
    # 1. Profanity filter
    text = profanity.censor(text)

    # 2. Sensitive data redaction
    patterns = [
        r"\b\d{3}-\d{2}-\d{4}\b",  # SSN
        r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}\b",  # email
        r"\b(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"  # phone
    ]

    for p in patterns:
        text = re.sub(p, "[REDACTED]", text)

    # 3. length limit
    if len(text) > MAX_ASSISTANT_OUTPUT_CHARS:
        return text[:MAX_ASSISTANT_OUTPUT_CHARS] + "..."
    return text