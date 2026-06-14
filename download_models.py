'''
Created by: Akash Saranathan        
Created on: 04/26/2026  
Modified on: 04/27/2026
Purpose: This script is designed to pre-download and cache the necessary models (ResNet18, BLIP, and CLIP) used in the NeMo agent.
            This ensures that the models are available locally, reducing latency during inference and improving the overall performance of the agent.
How to run: Run the script: `download_models.py`
'''

print("Starting model downloads...")

from torchvision.models import resnet18, ResNet18_Weights
from transformers import (
    BlipProcessor,
    BlipForConditionalGeneration,
    CLIPProcessor,
    CLIPModel
)

print("1/3 Downloading ResNet18...")
resnet18(weights=ResNet18_Weights.DEFAULT)
print("ResNet18 done.")

print("2/3 Downloading BLIP...")
BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
print("BLIP done.")

print("3/3 Downloading CLIP...")
CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
print("CLIP done.")

print("All models downloaded and cached successfully.")