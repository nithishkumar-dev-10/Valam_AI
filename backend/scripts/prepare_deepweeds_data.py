

import csv
import shutil
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "deepweeds"
IMAGES_DIR = RAW_DIR / "images"
LABELS_DIR = RAW_DIR / "labels"
OUT_DIR = PROJECT_ROOT / "data" / "deepweeds_processed"

FOLD = 0  # which of the 5 official folds to use (0-4)

SPLIT_FILES = {
    "train": LABELS_DIR / f"train_subset{FOLD}.csv",
    "val": LABELS_DIR / f"val_subset{FOLD}.csv",
    "test": LABELS_DIR / f"test_subset{FOLD}.csv",
}

CLASS_NAMES = {
    0: "Chinee_Apple",
    1: "Lantana",
    2: "Parkinsonia",
    3: "Parthenium",
    4: "Prickly_Acacia",
    5: "Rubber_Vine",
    6: "Siam_Weed",
    7: "Snake_Weed",
    8: "Negative",  # no weed present
}



def load_split_filenames(csv_path: Path) -> set:
    """Read a subset CSV and return the set of image filenames it contains."""
    filenames = set()
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        # subset CSVs have no header in some DeepWeeds releases -- handle both
        if header and header[0].strip().lower() not in ("filename", "image"):
            # first row was actually data, not a header
            filenames.add(header[0].strip())
        for row in reader:
            if row:
                filenames.add(row[0].strip())
    return filenames


def load_labels(csv_path: Path) -> dict:
    """Read labels.csv and return {filename: label_int}."""
    labels = {}
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        # labels.csv columns are typically: Filename, Label, Species
        for row in reader:
            fname = row.get("Filename") or row.get("filename")
            label = row.get("Label") or row.get("label")
            if fname is None or label is None:
                continue
            labels[fname.strip()] = int(label)
    return labels


def build_split(split_name: str, filenames: set, labels: dict) -> tuple[int, int]:
    """Copy each image in `filenames` into OUT_DIR/split_name/<ClassName>/."""
    copied, missing = 0, 0
    for fname in sorted(filenames):
        label = labels.get(fname)
        if label is None:
            missing += 1
            continue
        class_name = CLASS_NAMES.get(label, f"unknown_{label}")
        dest_dir = OUT_DIR / split_name / class_name
        dest_dir.mkdir(parents=True, exist_ok=True)

        src = IMAGES_DIR / fname
        if not src.exists():
            missing += 1
            continue

        shutil.copy2(src, dest_dir / fname)
        copied += 1
    return copied, missing


def main():
    print(f"Project root:  {PROJECT_ROOT}")
    print(f"Raw images:    {IMAGES_DIR}")
    print(f"Labels folder: {LABELS_DIR}")
    print(f"Output:        {OUT_DIR}")
    print(f"Using fold:    {FOLD}\n")

    if not IMAGES_DIR.exists():
        raise FileNotFoundError(f"Images folder not found: {IMAGES_DIR}")

    labels_csv = LABELS_DIR / "labels.csv"
    if not labels_csv.exists():
        raise FileNotFoundError(f"labels.csv not found: {labels_csv}")

    labels = load_labels(labels_csv)
    print(f"Loaded {len(labels)} label entries from labels.csv\n")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    total_copied = 0
    for split_name, split_csv in SPLIT_FILES.items():
        if not split_csv.exists():
            raise FileNotFoundError(f"Split file not found: {split_csv}")

        filenames = load_split_filenames(split_csv)
        copied, missing = build_split(split_name, filenames, labels)
        total_copied += copied
        print(f"[{split_name}] {copied} images copied, {missing} missing/skipped "
              f"(from {len(filenames)} listed)")

    print(f"\nDone. {total_copied} images organized into {OUT_DIR}")
    print("Class folders per split:")
    for split_name in SPLIT_FILES:
        split_dir = OUT_DIR / split_name
        if split_dir.exists():
            classes = sorted(p.name for p in split_dir.iterdir() if p.is_dir())
            print(f"  {split_name}: {classes}")


if __name__ == "__main__":
    main()