import torch
import torchvision
from torchvision import models, transforms
from PIL import Image
import numpy as np
import pytesseract
import pandas as pd
import os

# Load model
model = models.mobilenet_v2(pretrained=True)
num_ftrs = model.classifier[1].in_features
model.classifier[1] = torch.nn.Linear(num_ftrs, len(pd.read_csv('data/train.csv')['aircraft_type'].unique()))
model.load_state_dict(torch.load('models/aircraft_classifier.pth'))
model = model.to('cuda')
model.eval()

# Define transforms
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# OCR pipeline
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def predict_image(image_path):
    # Image classification
    image = Image.open(image_path).convert('RGB')
    input_tensor = transform(image).unsqueeze(0).to('cuda')
    with torch.no_grad():
        output = model(input_tensor)
    probabilities = torch.nn.functional.softmax(output, dim=1)
    predicted_class = probabilities.argmax(1).item()
    
    # OCR for registration
    ocr_result = pytesseract.image_to_string(image)
    
    # Return confidence scores
    return {
        'aircraft_type': predicted_class,
        'registration': ocr_result.strip(),
        'confidence': probabilities[0][predicted_class].item()
    }

# Example usage
results = [predict_image(os.path.join('images/test', img)) for img in os.listdir('images/test')]
pd.DataFrame(results).to_csv('inference_results.csv', index=False)