

import json
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
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

    # ---- 5. Leak-safe split: group by source plant/session ----
    # PlantVillage files are random UUIDs with no session metadata, so we
    # pre-grouped images by perceptual-hash proximity (same leaf/plant/session
    # form one group) in scripts/prepare_plantvillage_split.py and split by
    # whole group. This prevents same-plant images from straddling train/val.
    splt_path = BASE_DIR / "data" / "plantvillage_split.json"
    if not splt_path.exists():
        raise FileNotFoundError(
            f"{splt_path} not found — run scripts/prepare_plantvillage_split.py first"
        )
    with open(splt_path) as f:
        split_map = json.load(f)

    from torch.utils.data import Subset

    train_idx, val_idx = [], []
    for i, (path, _) in enumerate(full_dataset.samples):
        rel = str(Path(path).resolve().relative_to(DATA_DIR.resolve()))
        split = split_map.get(rel, {}).get("split")
        if split == "train":
            train_idx.append(i)
        elif split == "val":
            val_idx.append(i)

    train_dataset = Subset(full_dataset, train_idx)
    val_dataset = Subset(full_dataset, val_idx)

    BATCH_SIZE = 32
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=4)

    print(f"Train images: {len(train_idx)} | Validation images: {len(val_idx)} (group split)")

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

            running_loss += loss.detach() * images.size(0)
            _, predicted = outputs.max(1)
            correct += predicted.eq(labels).sum()
            total += labels.size(0)

        train_acc = 100 * float(correct) / total
        train_loss = float(running_loss) / total

        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, predicted = outputs.max(1)
                val_correct += predicted.eq(labels).sum()
                val_total += labels.size(0)

        val_acc = 100 * float(val_correct) / val_total
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