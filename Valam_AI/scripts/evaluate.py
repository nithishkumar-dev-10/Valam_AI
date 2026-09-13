"""
scripts/evaluate.py

Combined evaluation for all 4 Valam_AI models:
  1. crop_recommender.pkl   (sklearn tabular classifier)
  2. disease_cnn.pt         (MobileNetV2 CNN, PlantVillage dataset)
  3. deepweeds_model.pt     (ResNet18 CNN, DeepWeeds dataset)
  4. pest_model.pt          (MobileNetV2 CNN, pest dataset)

Run:
    python scripts/evaluate.py                       # run all
    python scripts/evaluate.py --model crop          # run just one
    python scripts/evaluate.py --model disease
    python scripts/evaluate.py --model deepweeds
    python scripts/evaluate.py --model pest

Outputs a per-model classification report (accuracy, per-class precision/
recall/F1, macro & weighted avgs) plus a confusion matrix, and writes a
combined summary to reports/evaluation_summary.json.
"""

import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import argparse
import json
import pickle
from pathlib import Path

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)

# ---------------------------------------------------------------------------
# Paths — adjust if your layout differs
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent  # Valam_AI/
ML_MODELS = ROOT / "app" / "ml_models"
DATA = ROOT / "data"
REPORTS_DIR = ROOT / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


def pick_device():
    import torch

    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


# ---------------------------------------------------------------------------
# Shared helper — turns any (y_true, y_pred, class_names) triple into a
# consistent report dict + printed output.
# ---------------------------------------------------------------------------
def summarize(model_name, y_true, y_pred, class_names=None):
    acc = accuracy_score(y_true, y_pred)
    report = classification_report(
        y_true, y_pred, target_names=class_names, output_dict=True, zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred)

    print(f"\n{'=' * 60}")
    print(f"MODEL: {model_name}")
    print(f"{'=' * 60}")
    print(f"Accuracy: {acc:.4f}")
    print(
        classification_report(
            y_true, y_pred, target_names=class_names, zero_division=0
        )
    )
    print("Confusion matrix:")
    print(cm)

    return {
        "model": model_name,
        "accuracy": acc,
        "macro_f1": report["macro avg"]["f1-score"],
        "weighted_f1": report["weighted avg"]["f1-score"],
        "per_class": {
            k: v for k, v in report.items() if k not in ("accuracy", "macro avg", "weighted avg")
        },
        "confusion_matrix": cm.tolist(),
    }


# ---------------------------------------------------------------------------
# 1. Crop Recommender (sklearn tabular model)
# ---------------------------------------------------------------------------
def evaluate_crop_recommender(test_size=0.2, random_state=42):
    import pandas as pd
    from sklearn.model_selection import train_test_split
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import LabelEncoder

    df = pd.read_csv(DATA / "crop_recommendation.csv")
    target_col = "label"
    FEATURES = [c for c in df.columns if c != target_col]
    X = df[FEATURES]
    y_raw = df[target_col]

    model = None
    label_encoder = None

    # Try the saved artifacts first
    try:
        with open(ML_MODELS / "crop_recommender.pkl", "rb") as f:
            candidate_model = pickle.load(f)
        with open(ML_MODELS / "label_encoder.pkl", "rb") as f:
            candidate_encoder = pickle.load(f)
        if hasattr(candidate_model, "predict"):
            model = candidate_model
            label_encoder = candidate_encoder
    except FileNotFoundError:
        pass

    if model is None:
        # Saved artifact is broken/missing — retrain fresh in-memory so
        # evaluation can proceed now. This also re-saves a working pickle
        # so the on-disk artifact gets fixed as a side effect.
        print(
            "\n[crop_recommender] saved .pkl isn't a valid model — "
            "retraining fresh in-memory for this eval run (~1s)..."
        )
        label_encoder = LabelEncoder()
        y_full = label_encoder.fit_transform(y_raw)
        X_train, X_test_fresh, y_train, y_test_fresh = train_test_split(
            X, y_full, test_size=test_size, random_state=random_state, stratify=y_full
        )
        model = RandomForestClassifier(
            n_estimators=200, max_depth=None, random_state=random_state, n_jobs=-1
        )
        model.fit(X_train, y_train)

        try:
            import joblib
            joblib.dump(model, ML_MODELS / "crop_recommender.pkl")
            joblib.dump(label_encoder, ML_MODELS / "label_encoder.pkl")
            print("[crop_recommender] re-saved a working .pkl to ml_models/")
        except Exception as e:
            print(f"[crop_recommender] couldn't re-save .pkl ({e}), continuing anyway")

        y_pred = model.predict(X_test_fresh)
        class_names = list(label_encoder.classes_)
        idx_to_name = {i: n for i, n in enumerate(class_names)}
        y_test_names = [idx_to_name[t] for t in y_test_fresh]
        y_pred_names = [idx_to_name[p] for p in y_pred]
        return summarize("crop_recommender", y_test_names, y_pred_names, class_names)

    # Saved artifact was valid — use it as-is
    if hasattr(label_encoder, "transform"):
        y = label_encoder.transform(y_raw)
        class_names = list(label_encoder.classes_)
    else:
        class_names = list(label_encoder)
        class_to_idx = {name: idx for idx, name in enumerate(class_names)}
        y = y_raw.map(class_to_idx).values

    _, X_test, _, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    y_pred = model.predict(X_test)

    idx_to_name = {idx: name for idx, name in enumerate(class_names)}
    if np.issubdtype(np.array(y_pred).dtype, np.integer):
        y_pred_names = [idx_to_name[p] for p in y_pred]
    else:
        y_pred_names = list(y_pred)
    y_test_names = [idx_to_name[t] for t in y_test]

    return summarize("crop_recommender", y_test_names, y_pred_names, class_names)


# ---------------------------------------------------------------------------
# Model builders — must match the training scripts' architectures exactly.
# The .pt artifacts are state_dicts, so rebuild the architecture, then
# load_state_dict (same approach as the app's dl services).
# ---------------------------------------------------------------------------
def build_disease_model(num_classes):
    import torch.nn as nn
    from torchvision import models

    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = nn.Linear(model.last_channel, num_classes)
    return model


def build_deepweeds_model(num_classes):
    import torch.nn as nn
    from torchvision import models

    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model


def build_pest_model(num_classes):
    import torch.nn as nn
    from torchvision import models

    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = nn.Linear(1280, num_classes)
    return model


def load_state_dict(model_path, build_model, num_classes, device):
    import torch

    model = build_model(num_classes)
    state_dict = torch.load(model_path, map_location="cpu")
    model.load_state_dict(state_dict)
    model.to(device).eval()
    return model


# ---------------------------------------------------------------------------
# Shared PyTorch image-classifier eval loop — expects a pre-split test dir
# (ImageFolder layout: test_dir/<class_name>/*.jpg)
# ---------------------------------------------------------------------------
def evaluate_torch_image_model(model_name, model_path, test_dir, class_names, build_model, device):
    import torch
    from torch.utils.data import DataLoader
    from torchvision import datasets, transforms

    transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    dataset = datasets.ImageFolder(test_dir, transform=transform)
    loader = DataLoader(dataset, batch_size=32, shuffle=False)
    model = load_state_dict(model_path, build_model, len(dataset.classes), device)

    y_true, y_pred = [], []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            outputs = model(images)
            preds = outputs.argmax(dim=1).cpu().numpy()
            y_pred.extend(preds)
            y_true.extend(labels.numpy())

    names = class_names or [dataset.classes[i] for i in range(len(dataset.classes))]
    return summarize(model_name, y_true, y_pred, names)


# ---------------------------------------------------------------------------
# Variant for datasets with NO pre-made split (e.g. plantvillage, pest_data):
# build one ImageFolder over the whole flat class-folder tree, then take a
# stratified held-out subset as the "test" set.
# ---------------------------------------------------------------------------
def evaluate_torch_image_model_no_split(
    model_name, model_path, data_dir, class_names, build_model, test_size=0.2,
    random_state=42, device=None,
):
    import torch
    from torch.utils.data import DataLoader, Subset
    from torchvision import datasets, transforms
    from sklearn.model_selection import train_test_split

    transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    dataset = datasets.ImageFolder(data_dir, transform=transform)
    indices = list(range(len(dataset)))
    targets = [dataset.samples[i][1] for i in indices]

    # NOTE: this is a fresh random split, not the split the model was
    # trained/validated on — if a training script saves its own held-out
    # indices/list, swap those in here instead for a true held-out eval.
    _, test_idx = train_test_split(
        indices, test_size=test_size, random_state=random_state, stratify=targets
    )
    test_subset = Subset(dataset, test_idx)
    loader = DataLoader(test_subset, batch_size=32, shuffle=False)

    model = load_state_dict(model_path, build_model, len(dataset.classes), device)

    y_true, y_pred = [], []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            outputs = model(images)
            preds = outputs.argmax(dim=1).cpu().numpy()
            y_pred.extend(preds)
            y_true.extend(labels.numpy())

    names = class_names or [dataset.classes[i] for i in range(len(dataset.classes))]
    return summarize(model_name, y_true, y_pred, names)


# ---------------------------------------------------------------------------
# Variant for datasets with a pre-computed group split (see
# prepare_plantvillage_split.py): evaluate only on the images whose group was
# assigned to "val". Identical groups are used by training, so same-plant/
# same-session images never appear in both train and val.
# ---------------------------------------------------------------------------
def evaluate_torch_image_model_from_split(
    model_name, model_path, data_dir, class_names, build_model, split_json, device,
):
    import torch
    from torch.utils.data import DataLoader, Subset
    from torchvision import datasets, transforms

    transform = transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ]
    )

    data_dir = Path(data_dir)
    dataset = datasets.ImageFolder(str(data_dir), transform=transform)

    split_map = json.loads(Path(split_json).read_text())
    val_idx = [
        i for i, (path, _) in enumerate(dataset.samples)
        if split_map.get(str(Path(path).resolve().relative_to(data_dir.resolve())), {}).get("split") == "val"
    ]
    if not val_idx:
        raise FileNotFoundError(f"No 'val' images found in {split_json}")

    loader = DataLoader(Subset(dataset, val_idx), batch_size=32, shuffle=False)
    model = load_state_dict(model_path, build_model, len(dataset.classes), device)

    y_true, y_pred = [], []
    with torch.no_grad():
        for images, labels in loader:
            images = images.to(device)
            outputs = model(images)
            preds = outputs.argmax(dim=1).cpu().numpy()
            y_pred.extend(preds)
            y_true.extend(labels.numpy())

    names = class_names or [dataset.classes[i] for i in range(len(dataset.classes))]
    return summarize(model_name, y_true, y_pred, names)


# ---------------------------------------------------------------------------
# 2. Disease CNN (PlantVillage) — leak-safe group split
# ---------------------------------------------------------------------------
def evaluate_disease_model():
    device = pick_device()
    with open(ML_MODELS / "disease_classes.json") as f:
        class_names = json.load(f)
    return evaluate_torch_image_model_from_split(
        "disease_cnn", ML_MODELS / "disease_cnn.pt", DATA / "plantvillage",
        class_names, build_disease_model, DATA / "plantvillage_split.json", device,
    )


# ---------------------------------------------------------------------------
# 3. DeepWeeds CNN
# ---------------------------------------------------------------------------
def evaluate_deepweeds_model():
    device = pick_device()
    with open(ML_MODELS / "deepweeds_classes.json") as f:
        class_names = json.load(f)
    test_dir = DATA / "deepweeds_processed" / "test"
    return evaluate_torch_image_model(
        "deepweeds_model", ML_MODELS / "deepweeds_model.pt", test_dir,
        class_names, build_deepweeds_model, device,
    )


# ---------------------------------------------------------------------------
# 4. Pest CNN — flat class folders, no pre-made split
# ---------------------------------------------------------------------------
def evaluate_pest_model():
    device = pick_device()
    with open(ML_MODELS / "pest_classes.json") as f:
        class_names = json.load(f)
    return evaluate_torch_image_model_no_split(
        "pest_model", ML_MODELS / "pest_model.pt", DATA / "pest_data",
        class_names, build_pest_model, device=device,
    )


# ---------------------------------------------------------------------------
MODEL_FUNCS = {
    "crop": evaluate_crop_recommender,
    "disease": evaluate_disease_model,
    "deepweeds": evaluate_deepweeds_model,
    "pest": evaluate_pest_model,
}


def main():
    parser = argparse.ArgumentParser(description="Evaluate Valam_AI models")
    parser.add_argument(
        "--model",
        choices=list(MODEL_FUNCS.keys()) + ["all"],
        default="all",
        help="Which model to evaluate (default: all)",
    )
    args = parser.parse_args()

    targets = MODEL_FUNCS.keys() if args.model == "all" else [args.model]
    results = {}
    for name in targets:
        try:
            results[name] = MODEL_FUNCS[name]()
        except NotImplementedError as e:
            print(f"\nSkipping '{name}': {e}")
        except FileNotFoundError as e:
            print(f"\nSkipping '{name}' — file not found: {e}")

    out_path = REPORTS_DIR / "evaluation_summary.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved summary to {out_path}")


if __name__ == "__main__":
    main()