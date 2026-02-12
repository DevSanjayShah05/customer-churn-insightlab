import os
import joblib
import pandas as pd
from io import BytesIO
import numpy as np

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware


# -------------------------
# Repo + model path helpers
# -------------------------
def find_repo_root(start: str) -> str:
    """
    Walk upward from `start` until we find a folder that looks like the repo root.
    Repo root criteria: contains README.md AND a data/ directory.
    """
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
MODEL_PATH = os.path.join(REPO_ROOT, "models", "churn_model.joblib")


# -------------------------
# Model cache (avoid re-load)
# -------------------------
_model_cache = None


def get_model():
    global _model_cache
    if _model_cache is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model not found at: {MODEL_PATH}")
        _model_cache = joblib.load(MODEL_PATH)
    return _model_cache


# -------------------------
# Explainability helpers
# -------------------------
def top_drivers_for_rows(pipeline, X: pd.DataFrame, top_k: int = 3):
    """
    Logistic Regression contributions in transformed feature space:
    contribution(feature) = transformed_value * coef

    Returns a list (per row) of top_k drivers by absolute contribution.
    """
    pre = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]

    Xt = pre.transform(X)  # often sparse
    feature_names = pre.get_feature_names_out()
    coef = model.coef_.ravel()

    drivers_all = []

    for i in range(Xt.shape[0]):
        row = Xt[i]

        # sparse case
        if hasattr(row, "tocsr"):
            row = row.tocsr()
            idx = row.indices
            vals = row.data

            if len(idx) == 0:
                drivers_all.append([])
                continue

            contrib = vals * coef[idx]
            order = np.argsort(-np.abs(contrib))[:top_k]

            top = []
            for j in order:
                impact = float(contrib[j])
                top.append(
                    {
                        "feature": str(feature_names[idx[j]]),
                        "impact": round(impact, 4),
                        "direction": "increases_churn" if impact > 0 else "decreases_churn",
                    }
                )
            drivers_all.append(top)

        else:
            # dense case
            arr = np.asarray(row).ravel()
            contrib = arr * coef
            order = np.argsort(-np.abs(contrib))[:top_k]

            top = []
            for j in order:
                impact = float(contrib[j])
                top.append(
                    {
                        "feature": str(feature_names[j]),
                        "impact": round(impact, 4),
                        "direction": "increases_churn" if impact > 0 else "decreases_churn",
                    }
                )
            drivers_all.append(top)

    return drivers_all


def global_importance(pipeline, top_n: int = 10):
    """
    Global importance: abs(coefficients) in transformed feature space.
    """
    pre = pipeline.named_steps["preprocess"]
    model = pipeline.named_steps["model"]

    feature_names = pre.get_feature_names_out()
    coef = model.coef_.ravel()
    imp = np.abs(coef)

    order = np.argsort(-imp)[:top_n]
    return [
        {"feature": str(feature_names[j]), "importance": round(float(imp[j]), 4)}
        for j in order
    ]


def risk_tier(p: float) -> str:
    if p < 0.33:
        return "low"
    elif p < 0.66:
        return "moderate"
    return "high"


# -------------------------
# FastAPI app
# -------------------------
app = FastAPI(title="Churn InsightLab API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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
async def predict_churn(
    file: UploadFile = File(...),
    threshold: float = 0.5,
    top_k: int = 3,
    limit: int = 200,
    include_drivers: bool = True,
    include_predictions: bool = True,
):
    # ✅ Use cached model (DO NOT reload every request)
    model = get_model()

    # Read CSV
    contents = await file.read()
    df = pd.read_csv(BytesIO(contents))
    df.columns = [c.strip() for c in df.columns]

    # Keep customerID for output if present
    customer_ids = None
    if "customerID" in df.columns:
        customer_ids = df["customerID"].astype(str)
        df = df.drop(columns=["customerID"])

    # Drop label if present
    if "Churn" in df.columns:
        df = df.drop(columns=["Churn"])

    # Match training cleaning
    if "TotalCharges" in df.columns:
        df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce")

    # Predict
    proba = model.predict_proba(df)[:, 1]
    pred = (proba >= threshold).astype(int)
    tiers = [risk_tier(float(p)) for p in proba]

    # Explainability (per row)
    drivers = top_drivers_for_rows(model, df, top_k=top_k)

    # Build output
    out = pd.DataFrame(
        {
            "churn_probability": proba,
            "churn_prediction": pred,
            "risk_tier": tiers,
            "top_drivers": drivers,
        }
    )

    if customer_ids is not None:
        out.insert(0, "customerID", customer_ids.values)

    total = int(len(out))
    pred_churn = int(out["churn_prediction"].sum())
    churn_rate = round(pred_churn / total, 4) if total > 0 else 0.0

    # Global importance
    glob = global_importance(model, top_n=10)

    # ✅ Limit response so Swagger + frontend don’t choke
    out_limited = out.head(max(0, int(limit))).copy()

    response = {
        "rows": total,
        "kpis": {
            "total_customers": total,
            "predicted_churners": pred_churn,
            "predicted_churn_rate": churn_rate,
        },
        "global_importance": glob,
    }

    if include_predictions:
        if not include_drivers and "top_drivers" in out_limited.columns:
            out_limited = out_limited.drop(columns=["top_drivers"])
        response["predictions"] = out_limited.to_dict(orient="records")

    return response