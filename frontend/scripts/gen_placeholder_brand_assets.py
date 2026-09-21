"""Generate PLACEHOLDER brand assets for the Android app.

These are intentionally simple programmatic stand-ins (brand colour + leaf
mark) so the build pipeline is complete and reviewable. THEY ARE NOT FINAL
DESIGN — replace resources/icon.png and resources/splash.png with real artwork
and re-run:  npx @capacitor/assets generate --android

Run:  python scripts/gen_placeholder_brand_assets.py
"""
from __future__ import annotations
import math
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "resources"
OUT.mkdir(exist_ok=True)

PINE = (30, 91, 60)      # #1e5b3c
LEAF = (62, 155, 106)    # #3e9b6a
HONEY = (232, 164, 59)   # #e8a43b
PAPER = (250, 246, 239)  # #faf6ef


def gradient(size: int, a, b) -> Image.Image:
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return img


def leaf_points(cx, cy, w, h, rot_deg=-18):
    pts = []
    steps = 80
    for i in range(steps + 1):
        u = i / steps
        x = cx + math.sin(math.pi * u) * (w / 2)
        y = cy - h / 2 + u * h
        pts.append((x, y))
    for i in range(steps, -1, -1):
        u = i / steps
        x = cx - math.sin(math.pi * u) * (w / 2)
        y = cy - h / 2 + u * h
        pts.append((x, y))
    r = math.radians(rot_deg)
    out = []
    for x, y in pts:
        dx, dy = x - cx, y - cy
        out.append((cx + dx * math.cos(r) - dy * math.sin(r),
                    cy + dx * math.sin(r) + dy * math.cos(r)))
    return out


def make_icon(size=1024):
    base = gradient(size, PINE, LEAF).convert("RGBA")
    d = ImageDraw.Draw(base)
    d.polygon(leaf_points(size / 2, size / 2, size * 0.44, size * 0.62), fill=HONEY)
    d.line(leaf_points(size / 2, size / 2, size * 0.02, size * 0.5), fill=PINE, width=max(2, size // 180))
    return base


def make_splash(size=2732):
    base = Image.new("RGBA", (size, size), PAPER + (255,))
    d = ImageDraw.Draw(base)
    s = size * 0.30
    d.polygon(leaf_points(size / 2, size / 2, s * 0.44, s * 0.62), fill=LEAF)
    return base


icon = make_icon()
# Play Store listing icon must be 512x512 with NO alpha channel:
icon.resize((512, 512), Image.LANCZOS).convert("RGB").save(OUT / "icon-512-playstore.png")
icon.convert("RGB").save(OUT / "icon.png")          # @capacitor/assets source (1024)
make_splash().convert("RGB").save(OUT / "splash.png")
print("wrote:", *(p.name for p in sorted(OUT.glob("*.png"))))
