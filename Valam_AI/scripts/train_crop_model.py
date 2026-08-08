

import pandas as pd
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report

# ---- Paths ----
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "crop_recommendation.csv"
MODEL_DIR = BASE_DIR / "app" / "ml_models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# ---- 1. Load data ----
df = pd.read_csv(DATA_PATH)
print(f"Loaded dataset: {df.shape[0]} rows, {df.shape[1]} columns")
print(f"Crops in dataset: {df['label'].nunique()}")

FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET = "label"

X = df[FEATURES]
y = df[TARGET]

# ---- 2. Encode crop labels (text -> numbers) ----
label_encoder = LabelEncoder()
y_encoded = label_encoder.fit_transform(y)

# ---- 3. Train/test split ----
X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
)

# ---- 4. Train Random Forest ----
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=None,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

# ---- 5. Evaluate ----
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
print(f"\nTest Accuracy: {acc * 100:.2f}%\n")
print(classification_report(y_test, y_pred, target_names=label_encoder.classes_))

# ---- 6. Feature importance (useful to sanity check the model) ----
importances = pd.Series(model.feature_importances_, index=FEATURES).sort_values(ascending=False)
print("Feature importance:")
print(importances)

# ---- 7. Save model + encoder ----
joblib.dump(model, MODEL_DIR / "crop_recommender.pkl")
joblib.dump(label_encoder, MODEL_DIR / "label_encoder.pkl")

print(f"\nModel saved to: {MODEL_DIR / 'crop_recommender.pkl'}")
print(f"Label encoder saved to: {MODEL_DIR / 'label_encoder.pkl'}")
