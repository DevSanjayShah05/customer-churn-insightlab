# Customer Churn InsightLab — End-to-End ML + Analytics Dashboard

Customer Churn InsightLab is a full-stack **Data Analysis + Machine Learning** project that predicts customer churn risk from tabular customer data and presents results in a clean, interactive dashboard. It is built to be **portfolio-ready** and demonstrates the complete workflow: **data → model → API → frontend insights**.

---

## 🎯 Goal

Customer churn is a costly business problem for subscription-based companies.  
The goal of this project is to build an end-to-end churn prediction product that:

- Predicts churn probability for each customer
- Groups customers into **Low / Moderate / High risk**
- Explains *why* the model predicts churn (top contributing features)
- Provides an easy-to-use dashboard for non-technical users

---

## ✅ What We Achieved (Project Outcomes)

### Machine Learning
- Built a baseline churn classifier using **Logistic Regression**
- Used a full **scikit-learn Pipeline** (preprocessing + model)
- Produced:
  - `churn_probability` (0 → 1)
  - `churn_prediction` (0/1 based on threshold)

### Explainability (Interpretability)
- Added **per-customer Top Drivers**: features that push churn probability up/down
- Added **global feature importance**: strongest features overall (abs(coefficients))

### Backend API (FastAPI)
- Implemented a production-style **FastAPI** backend with:
  - `GET /health` (status)
  - `POST /predict/churn` (CSV upload → predictions + KPIs + explainability)
- Optimized performance by **caching the model** instead of re-loading each request

### Frontend Dashboard (React + Recharts)
- Built a modern light-themed dashboard that includes:
  - KPI cards (total customers, churners, churn rate)
  - Risk distribution chart (low/moderate/high)
  - Global feature importance chart
  - Predictions table with per-customer top drivers
- Added quality-of-life features:
  - Risk filter
  - Row limit
  - Export predictions as **CSV**
  - Export API response as **JSON**

---

## 🧠 How Explainability Works

Since the model is Logistic Regression, we can compute per-feature contribution:

**contribution(feature) = transformed_value × coefficient**

For each customer we show the **Top K** features with the largest absolute contribution:
- **↑ churn** → increases churn probability
- **↓ churn** → decreases churn probability

---

## 🧰 Tech Stack

**Backend**
- Python, FastAPI
- pandas, numpy
- scikit-learn, joblib

**Frontend**
- React + Vite
- Recharts

---

## 📁 Project Structure

```text
customer-churn-insightlab/
├─ backend/
│  ├─ app/
│  │  └─ main.py                 # FastAPI API + inference + explainability
│  ├─ requirements.txt
│  └─ .venv/                     # local env (not committed)
├─ frontend/
│  ├─ src/
│  │  └─ App.jsx                 # dashboard UI
│  ├─ package.json
│  └─ vite.config.js
├─ data/
│  └─ raw/                       # dataset location (local)
├─ models/
│  └─ churn_model.joblib         # trained pipeline artifact
└─ README.md