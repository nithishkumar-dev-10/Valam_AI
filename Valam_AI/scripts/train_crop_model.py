import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "crop_recommendation.csv"
MODEL_DIR = BASE_DIR / "app" / "ml_models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


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

# ---- 3. Regularized Random Forest ----
# max_depth + min_samples_leaf stop the trees from memorizing the training
# rows (old model hit 100% train acc), which helps generalization to the
# district-level input features the app feeds in.
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=12,
    min_samples_leaf=2,
    random_state=42,
)
model.fit(X, y_encoded)

# ---- 4. Honest generalization estimate via 5-fold CV ----
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
cv_scores = cross_val_score(model, X, y_encoded, cv=cv)
print(f"\n5-fold CV Accuracy: {cv_scores.mean() * 100:.2f}% (+/- {cv_scores.std() * 100:.2f}%)")
print(f"per-fold: {[round(s * 100, 2) for s in cv_scores]}")

# ---- 5. Evaluate on a held-out split (same split style as before) ----
from sklearn.model_selection import train_test_split
X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
)
model_holdout = RandomForestClassifier(
    n_estimators=200, max_depth=12, min_samples_leaf=2, random_state=42
)
model_holdout.fit(X_train, y_train)
y_pred = model_holdout.predict(X_test)
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