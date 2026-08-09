
import argparse
import json
from pathlib import Path

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image


def load_model(model_path: Path, num_classes: int, device: torch.device) -> nn.Module:
    # Must match the architecture used in train_disease_model.py exactly,
    # otherwise the state_dict won't load.
    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = nn.Linear(model.last_channel, num_classes)
    model.load_state_dict(torch.load(model_path, map_location=device))
    model.to(device)
    model.eval()
    return model


def get_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    elif torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def predict(image_path: Path, model: nn.Module, class_names: list, device: torch.device, topk: int = 3):
    IMG_SIZE = 224
    transform = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])

    image = Image.open(image_path).convert("RGB")
    tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(tensor)
        probs = torch.softmax(outputs, dim=1)[0]
        top_probs, top_idxs = torch.topk(probs, k=min(topk, len(class_names)))

    return [
        (class_names[idx], prob.item() * 100)
        for prob, idx in zip(top_probs, top_idxs)
    ]


def main():
    parser = argparse.ArgumentParser(description="Test the trained disease model on a single image.")
    parser.add_argument("image_path", type=str, help="Path to the image file to classify")
    parser.add_argument("--topk", type=int, default=3, help="Number of top predictions to show (default: 3)")
    args = parser.parse_args()

    image_path = Path(args.image_path)
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    BASE_DIR = Path(__file__).resolve().parent.parent.parent
    MODEL_PATH = BASE_DIR / "app" / "ml_models" / "disease_cnn.pt"
    CLASSES_PATH = BASE_DIR / "app" / "ml_models" / "disease_classes.json"

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")
    if not CLASSES_PATH.exists():
        raise FileNotFoundError(f"Class labels file not found: {CLASSES_PATH}")

    with open(CLASSES_PATH, "r") as f:
        class_names = json.load(f)

    device = get_device()
    print(f"Using device: {device}")

    model = load_model(MODEL_PATH, num_classes=len(class_names), device=device)

    results = predict(image_path, model, class_names, device, topk=args.topk)

    print(f"\nImage: {image_path}")
    print("Predictions:")
    for rank, (label, confidence) in enumerate(results, start=1):
        print(f"  {rank}. {label:<40} {confidence:.2f}%")


if __name__ == "__main__":
    main()