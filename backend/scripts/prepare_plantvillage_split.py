"""
scripts/prepare_plantvillage_split.py

Build a leak-safe train/val split for the PlantVillage dataset.

PlantVillage filenames are random UUIDs, so there is no filename/session
metadata to group by. Instead we group images by *perceptual proximity*:
each image gets a 64-bit dHash (difference hash), and within each class we
union images whose hashes are <= GROUP_HAMMING bits apart (window of 8 in
sorted-hash order). Images from the same leaf/plant/session are near-
duplicates and therefore end up in the same group.

The split (85% train / 15% val, per class, by whole group) is then written
to data/plantvillage_split.json so training AND evaluation use the exact
same grouping — no image in the val set shares a group with any train image.

Run:
    python scripts/prepare_plantvillage_split.py
"""

import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "plantvillage"
SPLIT_OUT = BASE_DIR / "data" / "plantvillage_split.json"

GROUP_HAMMING = 16   # max dHash hamming distance to be considered the same plant/session
WINDOW = 8           # how many sorted-neighbours to compare per image
VAL_FRACTION = 0.15
SEED = 42


def dhash(path: Path) -> int:
    im = Image.open(path).convert("L").resize((9, 8))
    a = np.asarray(im, dtype=np.uint8)
    bits = a[:, :-1] > a[:, 1:]
    h = 0
    for row in bits:
        for b in row:
            h = (h << 1) | int(b)
    return h


def hamming(a: int, b: int) -> int:
    return (a ^ b).bit_count()


def main():
    records = []  # (relative_path, class_name, hash)
    for cls_dir in sorted(DATA_DIR.iterdir()):
        if not cls_dir.is_dir():
            continue
        for f in cls_dir.iterdir():
            if f.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                continue
            rel = f"{cls_dir.name}/{f.name}"
            try:
                records.append((rel, cls_dir.name, dhash(f)))
            except Exception as e:
                print(f"skipping {rel}: {e}")

    print(f"Hashed {len(records)} images")

    # union-find over images, connected by near-duplicate hashes
    parent = list(range(len(records)))
    size = [1] * len(records)

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra == rb:
            return
        if size[ra] < size[rb]:
            ra, rb = rb, ra
        parent[rb] = ra
        size[ra] += size[rb]

    by_class = defaultdict(list)
    for i, (*_, h) in enumerate(records):
        by_class[records[i][1]].append((h, i))

    edge_pairs = 0
    for cls, items in by_class.items():
        items.sort()
        for k, (h, i) in enumerate(items):
            for j in range(k + 1, min(k + WINDOW + 1, len(items))):
                if hamming(h, items[j][0]) <= GROUP_HAMMING:
                    union(i, items[j][1])
                    edge_pairs += 1

    group_sizes = defaultdict(int)
    for i in range(len(records)):
        group_sizes[find(i)] += 1
    n_groups = len(group_sizes)
    multi = sum(1 for s in group_sizes.values() if s > 1)
    single = sum(1 for s in group_sizes.values() if s == 1)
    print(f"Groups: {n_groups} total ({multi} multi-image, {single} singletons); "
          f"merge edges: {edge_pairs}")

    # per-class, split whole groups into train/val (stratified at class level)
    rng = np.random.default_rng(SEED)
    result = {}
    val_images = 0
    for cls in sorted(by_class):
        cls_groups = {}
        for i in range(len(records)):
            if records[i][1] == cls:
                root = find(i)
                cls_groups.setdefault(root, []).append(records[i][0])
        group_ids = sorted(cls_groups)
        rng.shuffle(group_ids)
        n_val = max(1, int(round(len(group_ids) * VAL_FRACTION)))
        val_groups = set(group_ids[:n_val])
        for gid, paths in cls_groups.items():
            split = "val" if gid in val_groups else "train"
            for p in paths:
                result[p] = {"group": int(gid), "class": cls, "split": split}
                if split == "val":
                    val_images += 1

    with open(SPLIT_OUT, "w") as f:
        json.dump(result, f, indent=2, sort_keys=True)

    train_images = len(records) - val_images
    print(f"Train images: {train_images} | Val images: {val_images}")
    print(f"Split JSON saved to {SPLIT_OUT}")


if __name__ == "__main__":
    main()