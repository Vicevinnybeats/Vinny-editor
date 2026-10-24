import torch
import torchvision
from torchvision import models, transforms
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

# Load test data
test_df = pd.read_csv('data/test.csv')
test_dataset = torch.utils.data.TensorDataset(
    torch.stack([torch.tensor(transform(Image.open(os.path.join('images/test', img))).flatten()) for img in test_df.iloc[:, 0]]),
    torch.tensor(test_df.iloc[:, 1])
)
test_loader = torch.utils.data.DataLoader(test_dataset, batch_size=32)

# Evaluate model
correct = 0
total = 0
with torch.no_grad():
    for inputs, labels in test_loader:
        inputs, labels = inputs.to('cuda'), labels.to('cuda')
        outputs = model(inputs)
        _, predicted = torch.max(outputs.data, 1)
        total += labels.size(0)
        correct += (predicted == labels).sum().item()

print(f'Accuracy: {100 * correct / total}%')