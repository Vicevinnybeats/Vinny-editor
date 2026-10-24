import requests
import os
import hashlib
from PIL import Image
import numpy as np
import csv
import pandas as pd
from sklearn.model_selection import train_test_split

# Create directories
os.makedirs('images', exist_ok=True)
os.makedirs('images/train', exist_ok=True)
os.makedirs('images/val', exist_ok=True)
os.makedirs('images/test', exist_ok=True)

# Download and validate images
with open('data/aircraft_dataset.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        url = row['image_url']
        registration = row['registration']
        airline = row['airline']
        aircraft_type = row['aircraft_type']
        
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                parsed = urlparse(url)
                filename = os.path.basename(parsed.path)
                hash_name = hashlib.md5(filename.encode()).hexdigest() + '.jpg'
                filepath = os.path.join('images/train', hash_name)
                
                with open(filepath, 'wb') as img_file:
                    img_file.write(response.content)
                
                try:
                    img = Image.open(filepath).convert('RGB')
                    width, height = img.size
                    if width < 100 or height < 100:
                        print(f"Low-res image: {url}")
                        os.remove(filepath)
                    else:
                        img_array = np.array(img)
                        if np.std(img_array) < 50:
                            print(f"Low-contrast image: {url}")
                            os.remove(filepath)
                        else:
                            with open(filepath, 'wb') as f:
                                f.write(response.content)
                except (IOError, SyntaxError):
                    print(f"Invalid image: {url}")
                    os.remove(filepath)
        except Exception as e:
            print(f"Error downloading {url}: {str(e)}")

# Load cleaned data
df = pd.read_csv('data/aircraft_dataset.csv')

# Filter valid images
valid_images = df[df['image_url'].apply(lambda x: os.path.exists(x))]

# Remove duplicates
valid_images = valid_images.drop_duplicates(subset=['registration'])

# Split into train/validation/test
train_df, temp_df = train_test_split(valid_images, test_size=0.3, random_state=42)
val_df, test_df = train_test_split(temp_df, test_size=0.5, random_state=42)

train_df.to_csv('data/train.csv', index=False)
val_df.to_csv('data/val.csv', index=False)
test_df.to_csv('data/test.csv', index=False)

# Analyze category distribution
train_counts = train_df.groupby(['airline', 'aircraft_type']).size().reset_index(name='count')
train_counts.to_csv('data/category_distribution.csv', index=False)