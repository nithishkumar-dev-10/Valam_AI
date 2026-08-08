

import json
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms, models


def main():
    # ---- 1. Paths ----
    BASE_DIR = Path(__file__).resolve().parent.parent
    DATA_DIR = BASE_DIR / "data" / "plantvillage"
    MODEL_DIR = BASE_DIR / "app" / "ml_models"
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # ---- 2. Pick the fastest available device ----
    if torch.backends.mps.is_available():
        device = torch.device("mps")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
    else:
        device = torch.device("cpu")

    print(f"Using device: {device}")

    # ---- 3. Image preprocessing ----
    IMG_SIZE = 224
    transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    # ---- 4. Load dataset from folders ----
    full_dataset = datasets.ImageFolder(root=str(DATA_DIR), transform=transform)
    class_names = full_dataset.classes
    num_classes = len(class_names)
    print(f"Found {len(full_dataset)} images across {num_classes} classes")

    # ---- 5. Split into train (85%) and validation (15%) ----
    val_size = int(0.15 * len(full_dataset))
    train_size = len(full_dataset) - val_size
    train_dataset, val_dataset = random_split(full_dataset, [train_size, val_size])

    BATCH_SIZE = 32
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=4)

    print(f"Train images: {train_size} | Validation images: {val_size}")

    # ---- 6. Load pre-trained MobileNetV2, replace final layer ----
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.DEFAULT)
    model.classifier[1] = nn.Linear(model.last_channel, num_classes)
    model = model.to(device)

    # ---- 7. Loss function and optimizer ----
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.0003)

    # ---- 8. Training loop ----
    EPOCHS = 5

    for epoch in range(EPOCHS):
        start = time.time()
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum().item()
            total += labels.size(0)

        train_acc = 100 * correct / total
        train_loss = running_loss / total

        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, predicted = outputs.max(1)
                val_correct += predicted.eq(labels).sum().item()
                val_total += labels.size(0)

        val_acc = 100 * val_correct / val_total
        elapsed = time.time() - start

        print(f"Epoch {epoch+1}/{EPOCHS} | "
              f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}% | "
              f"Val Acc: {val_acc:.2f}% | Time: {elapsed:.1f}s")

    # ---- 9. Save the trained model and class labels ----
    torch.save(model.state_dict(), MODEL_DIR / "disease_cnn.pt")

    with open(MODEL_DIR / "disease_classes.json", "w") as f:
        json.dump(class_names, f, indent=2)

    print(f"\nModel saved to: {MODEL_DIR / 'disease_cnn.pt'}")
    print(f"Class labels saved to: {MODEL_DIR / 'disease_classes.json'}")


if __name__ == "__main__":
    main()