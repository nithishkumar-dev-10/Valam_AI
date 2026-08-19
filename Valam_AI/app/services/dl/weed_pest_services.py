import io
import json

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from app.config import WEED_MODEL_PATH, WEED_CLASSES_PATH


class WeedPestService:
    def __init__(self):
        with open(WEED_CLASSES_PATH) as f:
            self.classes = json.load(f)
        num_classes = len(self.classes)

        # must match train_deepweeds_model.py build_model() architecture
        self.model = models.resnet18(weights=None)
        in_features = self.model.fc.in_features
        self.model.fc = nn.Linear(in_features, num_classes)

        state_dict = torch.load(WEED_MODEL_PATH, map_location="cpu")
        self.model.load_state_dict(state_dict)
        self.model.eval()

        # matches eval_transform from training (Resize 256 -> CenterCrop 224)
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                  std=[0.229, 0.224, 0.225]),
        ])

    def predict(self, image_bytes: bytes):
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self.transform(img).unsqueeze(0)
        with torch.no_grad():
            outputs = self.model(tensor)
            probs = torch.softmax(outputs, dim=1)[0]
            idx = int(torch.argmax(probs))
            confidence = float(probs[idx])
        return self.classes[idx], confidence


weed_pest_service = WeedPestService()