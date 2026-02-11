import os
import joblib
import pandas as pd
from io import BytesIO

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware


def find_repo_root(start: str) -> str:
    cur = os.path.abspath(start)
    while True:
        has_readme = os.path.exists(os.path.join(cur, "README.md"))
        has_data = os.path.isdir(os.path.join(cur, "data"))
        if has_readme and has_data:
            return cur

        parent = os.path.dirname(cur)
        if parent == cur:
            raise FileNotFoundError("Could not locate repo root (README.md + data/).")
        cur = parent


REPO_ROOT = find_repo_root(os.path.dirname(__file__))
MODEL_PATH = os.path.join(REPO_ROOT, "models", "churn_model.joblib")

app = FastAPI(title="Churn InsightLab API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Churn InsightLab API running. Go to /docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict/churn")
async def predict_churn(file: UploadFile = File(...), threshold: float = 0.5):
    if not os.path.exists(MODEL_PATH):
        return {"error": "Model not found. Train first."}

    model = joblib.load(MODEL_PATH)

    contents = await file.read()
    df = pd.read_csv(BytesIO(contents))
    df.columns = [c.strip() for c in df.columns]

    # Keep customerID for output if present
    customer_ids = None
    if "customerID" in df.columns:
        customer_ids = df["customerID"].astype(str)
        df = df.drop(columns=["customerID"])

    # Drop target if present
    if "Churn" in df.columns:
        df = df.drop(columns=["Churn"])

    # Match training cleaning
    if "TotalCharges" in df.columns:
        df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")

    proba = model.predict_proba(df)[:, 1]
    pred = (proba >= threshold).astype(int)

    out = pd.DataFrame({
        "churn_probability": proba,
        "churn_prediction": pred
    })

    if customer_ids is not None:
        out.insert(0, "customerID", customer_ids.values)

    return {"rows": int(len(out)), "predictions": out.to_dict(orient="records")}