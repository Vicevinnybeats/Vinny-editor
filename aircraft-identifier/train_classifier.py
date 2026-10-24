import torch
import torchvision
from torchvision import models, transforms
from torch.utils.data import Dataset, DataLoader
import pandas as pd
import os

# Define dataset
class AircraftDataset(Dataset):
    def __init__(self, csv_file, root_dir, transform=None):
        self.df = pd.read_csv(csv_file)
        self.root_dir = root_dir
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        img_name = self.df.iloc[idx, 0]  # Assuming image filenames are in the first column
        img_path = os.path.join(self.root_dir, img_name)
        label = self.df.iloc[idx, 1]  # Assuming labels are in the second column
        image = Image.open(img_path).convert('RGB')
        if self.transform:
            image = self.transform(image)
        return image, label

# Define transforms
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# Initialize model
model = models.mobilenet_v2(pretrained=True)
num_ftrs = model.classifier[1].in_features
model.classifier[1] = torch.nn.Linear(num_ftrs, len(train_df['aircraft_type'].unique()))
model = model.to('cuda')

# Define loss and optimizer
criterion = torch.nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

# Train the model
dataset = AircraftDataset('data/train.csv', 'images/train', transform=transform)
dataloader = DataLoader(dataset, batch_size=32, shuffle=True)

for epoch in range(10):  # Train for 10 epochs
    for inputs, labels in dataloader:
        inputs, labels = inputs.to('cuda'), labels.to('cuda')
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
    print(f'Epoch {epoch+1}, Loss: {loss.item()}')

# Save the model
torch.save(model.state_dict(), 'models/aircraft_classifier.pth')