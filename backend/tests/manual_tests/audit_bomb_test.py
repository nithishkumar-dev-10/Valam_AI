"""Decompression-bomb guard test. Run: python audit_bomb_test.py
Sets MAX_IMAGE_PIXELS to 100 BEFORE importing the app, so any real image
(even 1x1) is rejected — proving the pixel-dimension guard fires pre-decode."""

import io
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

os.environ["SECRET_KEY"] = "a" * 64
os.environ["MAX_IMAGE_PIXELS"] = "100"

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

buf = io.BytesIO()
Image.fromarray(np.zeros((20, 20, 3), dtype=np.uint8)).save(buf, format="PNG")
tiny_png = buf.getvalue()

with TestClient(app) as client:
    r_voice = client.post(
        "/api/v1/voice/query",
        files={"image": ("leaf.png", tiny_png, "image/png")},
        data={},
    )
    print("voice+image w/ 20x20 (>100 px):", r_voice.status_code, r_voice.text[:120])
    assert r_voice.status_code == 415, r_voice.text
    r_disease = client.post(
        "/api/v1/predict/disease",
        files={"file": ("leaf.png", tiny_png, "image/png")},
    )
    print("disease w/ 20x20 (>100 px):", r_disease.status_code)
    assert r_disease.status_code == 415, r_disease.text
print("=== BOMB GUARD OK ===")