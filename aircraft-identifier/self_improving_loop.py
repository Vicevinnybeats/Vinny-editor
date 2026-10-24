import pandas as pd
import os
from datetime import datetime

# Save low-confidence predictions
def save_low_confidence(threshold=0.7):
    df = pd.read_csv('inference_results.csv')
    low_confidence = df[df['confidence'] < threshold]
    low_confidence.to_csv(f'low_confidence/{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv', index=False)

# Allow manual correction
def manual_correction():
    df = pd.read_csv('inference_results.csv')
    df['manual_correction'] = df['registration']
    df.to_csv('corrected_inference.csv', index=False)

# Retrain model with new data
def retrain_model():
    df = pd.read_csv('corrected_inference.csv')
    df.to_csv('data/train.csv', index=False)
    # Re-run training script here