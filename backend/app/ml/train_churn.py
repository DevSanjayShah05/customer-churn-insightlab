import os
import joblib
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression

# File is: backend/app/ml/train_churn.py
# Go up 4 levels to repo root
def find_repo_root(start: str) -> str:
    cur = os.path.abspath(start)
    while True:
        has_readme = os.path.exists(os.path.join(cur, "README.md"))
        has_data = os.path.isdir(os.path.join(cur, "data"))
        if has_readme and has_data:
            return cur

        parent = os.path.dirname(cur)
        if parent == cur:  # reached filesystem root
            raise FileNotFoundError("Could not locate repo root (README.md + data/).")
        cur = parent

REPO_ROOT = find_repo_root(os.path.dirname(__file__))

DATA_PATH = os.path.join(REPO_ROOT, "data", "raw", "telco_churn.csv")
MODEL_DIR = os.path.join(REPO_ROOT, "models")
MODEL_PATH = os.path.join(MODEL_DIR, "churn_model.joblib")

def load_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = [c.strip() for c in df.columns]

    if "TotalCharges" in df.columns:
        df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")

    if "customerID" in df.columns:
        df = df.drop(columns=["customerID"])

    if "Churn" not in df.columns:
        raise ValueError("Expected 'Churn' column in dataset")

    df["Churn"] = df["Churn"].map({"Yes": 1, "No": 0})
    return df

def build_pipeline(X: pd.DataFrame) -> Pipeline:
    numeric_cols = X.select_dtypes(include=["number"]).columns.tolist()
    categorical_cols = [c for c in X.columns if c not in numeric_cols]

    num_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    cat_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore")),
    ])

    preprocessor = ColumnTransformer([
        ("num", num_pipe, numeric_cols),
        ("cat", cat_pipe, categorical_cols),
    ])

    model = LogisticRegression(max_iter=5000, solver="saga")

    return Pipeline([
        ("preprocess", preprocessor),
        ("model", model),
    ])

def main():
    print("REPO_ROOT:", REPO_ROOT)
    print("DATA_PATH:", DATA_PATH)

    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at: {DATA_PATH}")

    df = load_data(DATA_PATH)
    X = df.drop(columns=["Churn"])
    y = df["Churn"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    pipeline = build_pipeline(X_train)
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    print("ROC-AUC:", round(roc_auc_score(y_test, y_proba), 4))
    print(classification_report(y_test, y_pred))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    print(f"Saved model to: {MODEL_PATH}")

if __name__ == "__main__":
    main()
