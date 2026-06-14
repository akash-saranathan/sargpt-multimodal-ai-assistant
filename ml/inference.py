'''
Created by: Akash Saranathan        
Created on: 04/09/2026  
Modified on: 04/27/2026
Purpose: Inference code for the multimodal agent, defining a predict_image function that uses ResNet, BLIP, and CLIP models to analyze an image and return a description of its contents. This code loads the necessary models and processes the image to provide a comprehensive understanding of what is depicted in the image, which can then be used by the agent's tools to classify images effectively.
How to run: Import the predict_image function and call it with the path to an image file. The function will return a string describing the contents of the image based on the analysis from the ResNet, BLIP, and CLIP models.

'''

import torch
from PIL import Image
from torchvision.models import resnet18, ResNet18_Weights
from transformers import CLIPProcessor, CLIPModel, BlipProcessor, BlipForConditionalGeneration

# -------------------------
# DEVICE
# -------------------------
device = "cuda" if torch.cuda.is_available() else "cpu"

# -------------------------
# LOAD RESNET
# -------------------------
weights = ResNet18_Weights.DEFAULT
resnet_model = resnet18(weights=weights).to(device)
resnet_model.eval()
resnet_labels = weights.meta["categories"]
resnet_transform = weights.transforms()

# -------------------------
# LOAD BLIP
# -------------------------
blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
blip_model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base"
).to(device)
blip_model.eval()

# -------------------------
# LOAD CLIP
# -------------------------
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
clip_model.eval()

# -------------------------
# MAIN FUNCTION
# -------------------------
def predict_image(image_path: str) -> str:
    image = Image.open(image_path).convert("RGB")

    # ===== RESNET — let it decide what it sees, no label filtering =====
    img_tensor = resnet_transform(image).unsqueeze(0).to(device)
    with torch.no_grad():
        resnet_out = resnet_model(img_tensor)
    probs = torch.nn.functional.softmax(resnet_out[0], dim=0)
    top_prob, top_catid = torch.topk(probs, 1)
    resnet_label = resnet_labels[top_catid[0]]
    resnet_conf = float(top_prob[0]) * 100

    # ===== BLIP — free form caption =====
    blip_inputs = blip_processor(image, return_tensors="pt").to(device)
    with torch.no_grad():
        out = blip_model.generate(**blip_inputs, max_new_tokens=60)
    caption = blip_processor.decode(out[0], skip_special_tokens=True)

    # ===== CLIP — scene context =====
    prompts = [
        "a city skyline or urban landscape",
        "a landmark or famous building",
        "an animal or pet",
        "a person or people",
        "a natural landscape or scenery",
        "food or drink",
        "a vehicle or transportation",
        "an indoor scene or room",
        "a document or text",
        "an abstract or artistic image",
    ]
    clip_inputs = clip_processor(
        text=prompts, images=image, return_tensors="pt", padding=True
    ).to(device)
    with torch.no_grad():
        clip_outputs = clip_model(**clip_inputs)
    clip_probs = clip_outputs.logits_per_image.softmax(dim=1)[0]
    top_clip_prob, top_clip_idx = torch.topk(clip_probs, 1)
    clip_label = prompts[top_clip_idx[0]]
    clip_conf = float(top_clip_prob[0]) * 100

    # ===== ROUTING =====
    # ResNet is confident → always trust it, it knows its 1000 categories
    if resnet_conf > 30:
        result = f"{caption}, specifically a {resnet_label}."

    # ResNet not confident → fall back to BLIP + CLIP for scenes/landmarks
    elif clip_conf > 60:
        result = f"{caption}, which appears to be {clip_label}."

    # Nothing confident → just BLIP
    else:
        result = f"{caption}."

    return result

