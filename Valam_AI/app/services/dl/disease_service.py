import io
import json
import threading

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms

from app.config import DISEASE_MODEL_PATH, DISEASE_CLASSES_PATH


class DiseaseService:
    def __init__(self):
        self.model = None
        self.classes = None
        self.transform = None
        self._lock = threading.Lock()

    def _ensure_loaded(self):
        if self.model is not None:
            return
        with self._lock:
            if self.model is not None:
                return

            with open(DISEASE_CLASSES_PATH) as f:
                self.classes = json.load(f)
            num_classes = len(self.classes)

            # must match train_disease_model.py architecture exactly
            model = models.mobilenet_v2(weights=None)
            model.classifier[1] = nn.Linear(model.last_channel, num_classes)

            state_dict = torch.load(DISEASE_MODEL_PATH, map_location="cpu")
            model.load_state_dict(state_dict)
            model.eval()
            self.model = model

            # same as training transform (no augmentation, plain resize)
            self.transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                      std=[0.229, 0.224, 0.225]),
            ])

    def predict(self, image_bytes: bytes):
        self._ensure_loaded()
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = self.transform(img).unsqueeze(0)
        with torch.no_grad():
            outputs = self.model(tensor)
            probs = torch.softmax(outputs, dim=1)[0]
            idx = int(torch.argmax(probs))
            confidence = float(probs[idx])
        return self.classes[idx], confidence


disease_service = DiseaseService()