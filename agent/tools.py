'''
Created by: Akash Saranathan        
Created on: 04/10/2026  
Modified on: 04/27/2026
Purpose: Tool definition for the multimodal agent, specifically the classify_image tool that utilizes the predict_image function from the inference code. This tool is designed to be used by the agent to analyze images and return descriptions of their contents. The tool is defined using LangChain's @tool decorator, making it easily integrable into the agent's workflow for processing image classification tasks.
How to run: Import the classify_image tool and use it within the agent's processing to classify images as needed. The tool can be called with the path to an image file, and it will return the predicted label based on the inference code.


'''


from langchain.tools import tool
from ml.inference import predict_image


@tool
def classify_image(image_path: str) -> str:
    """
    Use this tool when you are given an image.
    It returns what the image contains.
    """
    result = predict_image(image_path)
    return f"The image contains: {result}"