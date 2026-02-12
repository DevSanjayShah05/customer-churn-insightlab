import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

// Phase C: env-based API base (for deployment)
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const COLORS = {
  high: "#ef4444", // red
  moderate: "#f59e0b", // amber
  low: "#22c55e", // green
  primary: "#2563eb", // blue
  cardBorder: "#e5e7eb",
  text: "#0f172a",
  subtext: "#475569",
  bg: "#f6f7fb",
};

export default function App() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Modal for clickable badges
  const [modal, setModal] = useState({ open: false, title: "", body: null });
  function openModal(title, body) {
    setModal({ open: true, title, body });
  }
  function closeModal() {
    setModal({ open: false, title: "", body: null });
  }

  async function onPredict() {
    setError("");
    setLoading(true);

    try {
      if (!file) throw new Error("Please choose a CSV file.");

      const form = new FormData();
      form.append("file", file);

      const url = `${API_BASE}/predict/churn?threshold=0.5&top_k=3&limit=${limit}&include_drivers=true&include_predictions=true`;
      const res = await fetch(url, { method: "POST", body: form });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`API error ${res.status}: ${txt}`);
      }

      const json = await res.json();
      setData(json);
    } catch (e) {
      setData(null);
      setError(e?.message || "Failed to fetch.");
    } finally {
      setLoading(false);
    }
  }

  // Phase C: Clear UI state
  function onClear() {
    setData(null);
    setError("");
    setRiskFilter("all");
  }

  // Phase C: Download full response JSON
  function downloadJSON() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "churn_results.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const rows = data?.predictions || [];
  const kpis = data?.kpis || null;
  const globalImportance = data?.global_importance || [];

  const filteredRows = useMemo(() => {
    if (riskFilter === "all") return rows;
    return rows.filter((r) => r.risk_tier === riskFilter);
  }, [rows, riskFilter]);

  const riskCounts = useMemo(() => {
    const counts = { low: 0, moderate: 0, high: 0 };
    rows.forEach((r) => {
      if (counts[r.risk_tier] !== undefined) counts[r.risk_tier]++;
    });
    return counts;
  }, [rows]);

  const riskChartData = useMemo(() => {
    return [
      { tier: "low", count: riskCounts.low },
      { tier: "moderate", count: riskCounts.moderate },
      { tier: "high", count: riskCounts.high },
    ];
  }, [riskCounts]);

  const importanceChartData = useMemo(() => {
    return globalImportance.map((d) => ({
      feature: cleanFeatureName(String(d.feature)),
      importance: Number(d.importance),
    }));
  }, [globalImportance]);

  function downloadCSV() {
    if (!filteredRows.length) return;

    const headers = Object.keys(filteredRows[0]).filter(
      (k) => k !== "top_drivers"
    );
    const csv = [
      headers.join(","),
      ...filteredRows.map((r) =>
        headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "churn_predictions.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.page}>
      {/* HEADER */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerTopRow}>
            <div style={styles.brand}>
              <div style={styles.logoDot} />
              <div>
                <div style={styles.brandName}>Customer Churn InsightLab</div>
                <div style={styles.brandSub}>
                  Upload customer data → churn probability + risk tier + KPIs +
                  explainability
                </div>
              </div>
            </div>

            <div style={styles.badges}>
              <button
                style={styles.badgeBtn}
                onClick={() =>
                  openModal(
                    "ML + FastAPI",
                    <div>
                      <p style={styles.modalP}>
                        This app runs a scikit-learn churn model behind a FastAPI
                        service.
                      </p>
                      <ul style={styles.modalUl}>
                        <li>
                          <b>GET</b> /health — API status
                        </li>
                        <li>
                          <b>POST</b> /predict/churn — upload CSV → predictions +
                          KPIs
                        </li>
                      </ul>
                      <p style={styles.modalP}>
                        The React frontend calls the API and renders KPIs,
                        charts, and per-customer risk.
                      </p>
                    </div>
                  )
                }
              >
                ML + FastAPI
              </button>

              <button
                style={styles.badgeBtn}
                onClick={() =>
                  openModal(
                    "Logistic Regression",
                    <div>
                      <p style={styles.modalP}>
                        Baseline churn classifier using Logistic Regression with
                        preprocessing (one-hot encoding + scaling) in a single
                        pipeline.
                      </p>
                      <ul style={styles.modalUl}>
                        <li>Outputs churn probability (0 → 1)</li>
                        <li>
                          Threshold default: 0.5 (adjustable via API query
                          param)
                        </li>
                        <li>Strong baseline: fast + interpretable</li>
                      </ul>
                    </div>
                  )
                }
              >
                Logistic Regression
              </button>

              <button
                style={styles.badgeBtn}
                onClick={() =>
                  openModal(
                    "Explainable Predictions",
                    <div>
                      <p style={styles.modalP}>
                        For each customer, we compute <b>top drivers</b> from
                        Logistic Regression:
                      </p>
                      <p style={styles.modalP}>
                        contribution(feature) = transformed_value × coefficient
                      </p>
                      <ul style={styles.modalUl}>
                        <li>
                          <b>↑ churn</b>: feature increases churn probability
                        </li>
                        <li>
                          <b>↓ churn</b>: feature decreases churn probability
                        </li>
                        <li>We show top 3 drivers by absolute impact</li>
                      </ul>
                    </div>
                  )
                }
              >
                Explainable
              </button>
            </div>
          </div>

          {/* Controls */}
          <div style={styles.controls}>
            <div style={styles.fileWrap}>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div style={styles.smallMuted}>
                {file ? `Selected: ${file.name}` : "Upload a CSV (Telco churn format)"}
              </div>
            </div>

            <button onClick={onPredict} disabled={loading} style={styles.primaryBtn}>
              {loading ? "Predicting..." : "Upload & Predict"}
            </button>

            <div style={styles.rightControls}>
              <div>
                <div style={styles.label}>Filter</div>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  style={styles.select}
                >
                  <option value="all">All</option>
                  <option value="high">High</option>
                  <option value="moderate">Moderate</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <div style={styles.label}>Rows</div>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  style={styles.select}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              <button
                onClick={downloadCSV}
                disabled={!filteredRows.length}
                style={styles.secondaryBtn}
              >
                Download CSV
              </button>

              <button
                onClick={downloadJSON}
                disabled={!data}
                style={styles.secondaryBtn}
              >
                Download JSON
              </button>

              <button onClick={onClear} style={styles.secondaryBtn}>
                Clear
              </button>
            </div>
          </div>

          {error && <div style={styles.errorBox}>⚠️ {error}</div>}

          <div style={styles.envHint}>
            API: <span style={styles.envHintMono}>{API_BASE}</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        {/* KPIs */}
        <div style={styles.kpiGrid}>
          <KpiCard
            label="Total customers"
            value={kpis ? kpis.total_customers : "—"}
            hint="Rows in dataset"
          />
          <KpiCard
            label="Predicted churners"
            value={kpis ? kpis.predicted_churners : "—"}
            hint="Predicted churn = 1"
          />
          <KpiCard
            label="Predicted churn rate"
            value={kpis ? `${(kpis.predicted_churn_rate * 100).toFixed(1)}%` : "—"}
            hint="Pred churners / total"
          />
        </div>

        {/* Charts */}
        {rows.length > 0 && (
          <div style={styles.chartGrid}>
            <Card title="Risk Distribution" subtitle="Customers by predicted risk tier">
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tier" />
                    <YAxis />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count">
                      {riskChartData.map((entry, idx) => (
                        <Cell key={idx} fill={COLORS[entry.tier]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Top Feature Importance" subtitle="Global impact from coefficients">
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={importanceChartData}
                    layout="vertical"
                    margin={{ left: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="feature" width={190} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="importance" fill={COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card
          title="Predictions"
          subtitle={`Showing ${filteredRows.length} row(s) (limit ${limit})`}
          right={
            rows.length > 0 && (
              <div style={styles.riskPills}>
                <RiskPill tone="high" label="High" value={riskCounts.high} />
                <RiskPill
                  tone="moderate"
                  label="Moderate"
                  value={riskCounts.moderate}
                />
                <RiskPill tone="low" label="Low" value={riskCounts.low} />
              </div>
            )
          }
        >
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Customer ID</th>
                  <th style={styles.th}>Churn Prob</th>
                  <th style={styles.th}>Prediction</th>
                  <th style={styles.th}>Risk</th>
                  <th style={styles.th}>Top Drivers</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td style={styles.td} colSpan={5}>
                      Upload a CSV and click <b>Upload & Predict</b>.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r, idx) => (
                    <tr key={idx} style={idx % 2 ? styles.rowAlt : undefined}>
                      <td style={styles.tdMono}>{r.customerID ?? "—"}</td>
                      <td style={styles.td}>
                        {Number(r.churn_probability).toFixed(3)}
                      </td>
                      <td style={styles.td}>
                        {r.churn_prediction === 1 ? (
                          <span style={styles.predBad}>Churn</span>
                        ) : (
                          <span style={styles.predGood}>No churn</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{ ...styles.pill, ...pillFor(r.risk_tier) }}>
                          {r.risk_tier}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <DriverList drivers={r.top_drivers} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={styles.smallMuted2}>
            Tip: Increase “Rows” to 200 for more results. API intentionally limits response size.
          </div>
        </Card>
      </div>

      {/* MODAL */}
      {modal.open && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>{modal.title}</div>
              <button style={styles.modalClose} onClick={closeModal}>
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>{modal.body}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- components ---------- */

function Card({ title, subtitle, right, children }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div>
          <div style={styles.cardTitle}>{title}</div>
          <div style={styles.cardSub}>{subtitle}</div>
        </div>
        {right || null}
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function KpiCard({ label, value, hint }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiHint}>{hint}</div>
    </div>
  );
}

function RiskPill({ tone, label, value }) {
  return (
    <div style={{ ...styles.riskPill, borderColor: COLORS[tone] }}>
      <span style={{ ...styles.dot, background: COLORS[tone] }} />
      <span style={styles.riskLabel}>{label}</span>
      <span style={styles.riskValue}>{value}</span>
    </div>
  );
}

function DriverList({ drivers }) {
  if (!Array.isArray(drivers) || drivers.length === 0)
    return <span style={styles.mutedCell}>—</span>;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {drivers.map((d, i) => (
        <div key={i} style={styles.driverRow}>
          <span style={styles.driverFeature}>{humanizeDriver(d.feature)}</span>
          <span style={{ ...styles.driverTag, ...tagFor(d.direction) }}>
            {d.direction === "increases_churn" ? "↑ churn" : "↓ churn"}
          </span>
          <span style={styles.driverImpact}>{d.impact}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- helpers ---------- */

function pillFor(tier) {
  if (tier === "high")
    return { background: "#fee2e2", borderColor: COLORS.high, color: "#991b1b" };
  if (tier === "moderate")
    return {
      background: "#ffedd5",
      borderColor: COLORS.moderate,
      color: "#92400e",
    };
  return { background: "#dcfce7", borderColor: COLORS.low, color: "#166534" };
}

function tagFor(direction) {
  if (direction === "increases_churn")
    return { background: "#fee2e2", borderColor: COLORS.high, color: "#991b1b" };
  return { background: "#dcfce7", borderColor: COLORS.low, color: "#166534" };
}

function cleanFeatureName(name) {
  return name.replace("preprocess__", "").slice(0, 42);
}

function humanizeDriver(name) {
  return String(name)
    .replace("preprocess__", "")
    .replace(/_/g, " ")
    .slice(0, 48);
}

const tooltipStyle = {
  background: "white",
  border: `1px solid ${COLORS.cardBorder}`,
  borderRadius: 10,
  color: COLORS.text,
};

/* ---------- styles ---------- */

const styles = {
  page: {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: COLORS.bg,
    minHeight: "100vh",
    color: COLORS.text,
  },

  header: {
    background:
      "linear-gradient(120deg, rgba(37,99,235,0.14) 0%, rgba(34,197,94,0.10) 45%, rgba(245,158,11,0.10) 100%)",
    borderBottom: `1px solid ${COLORS.cardBorder}`,
  },
  headerInner: { maxWidth: 1100, margin: "0 auto", padding: "22px 22px 18px" },
  headerTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  brand: { display: "flex", gap: 12, alignItems: "center" },
  logoDot: {
    width: 14,
    height: 14,
    borderRadius: 99,
    background: COLORS.primary,
    boxShadow: "0 0 0 6px rgba(37,99,235,0.14)",
  },
  brandName: { fontSize: 22, fontWeight: 900, letterSpacing: -0.3 },
  brandSub: { fontSize: 13, color: COLORS.subtext, marginTop: 2 },

  badges: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" },
  badgeBtn: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.75)",
    border: `1px solid ${COLORS.cardBorder}`,
    cursor: "pointer",
  },

  controls: {
    marginTop: 14,
    background: "white",
    border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 12,
    alignItems: "center",
  },
  fileWrap: { display: "flex", flexDirection: "column" },
  smallMuted: { fontSize: 12, color: COLORS.subtext, marginTop: 6 },

  primaryBtn: {
    background: COLORS.primary,
    color: "white",
    border: "none",
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "white",
    color: COLORS.text,
    border: `1px solid ${COLORS.cardBorder}`,
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
  },

  rightControls: {
    display: "flex",
    gap: 10,
    alignItems: "end",
    justifyContent: "end",
    flexWrap: "wrap",
  },
  label: { fontSize: 12, color: COLORS.subtext, marginBottom: 6 },
  select: {
    background: "white",
    color: COLORS.text,
    border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 10,
    padding: "10px 10px",
  },

  errorBox: {
    marginTop: 12,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    padding: 12,
    borderRadius: 12,
    color: "#991b1b",
  },

  envHint: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.subtext,
  },
  envHintMono: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    color: COLORS.text,
  },

  main: { maxWidth: 1100, margin: "0 auto", padding: "16px 22px 40px" },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    background: "white",
    border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 14,
    padding: 16,
  },
  kpiLabel: { fontSize: 12, color: COLORS.subtext },
  kpiValue: {
    fontSize: 32,
    fontWeight: 900,
    marginTop: 6,
    letterSpacing: -0.4,
  },
  kpiHint: { fontSize: 12, color: COLORS.subtext, marginTop: 6 },

  chartGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 12,
  },

  card: {
    background: "white",
    border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 14,
    padding: 14,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "end",
  },
  cardTitle: { fontSize: 14, fontWeight: 900 },
  cardSub: { fontSize: 12, color: COLORS.subtext, marginTop: 4 },

  riskPills: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "end",
  },
  riskPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid",
    background: "white",
  },
  dot: { width: 10, height: 10, borderRadius: 99 },
  riskLabel: { fontSize: 12, color: COLORS.subtext },
  riskValue: { fontSize: 12, fontWeight: 900 },

  tableWrap: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
    border: `1px solid ${COLORS.cardBorder}`,
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "12px 12px",
    fontSize: 12,
    color: COLORS.subtext,
    background: "#fafafa",
    borderBottom: `1px solid ${COLORS.cardBorder}`,
  },
  td: {
    padding: "12px 12px",
    borderBottom: `1px solid ${COLORS.cardBorder}`,
    fontSize: 13,
    verticalAlign: "top",
  },
  tdMono: {
    padding: "12px 12px",
    borderBottom: `1px solid ${COLORS.cardBorder}`,
    fontSize: 13,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    verticalAlign: "top",
  },
  rowAlt: { background: "#fcfcfd" },

  pill: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "capitalize",
  },
  predBad: { fontWeight: 900, color: "#b91c1c" },
  predGood: { fontWeight: 900, color: "#166534" },

  mutedCell: { color: COLORS.subtext },

  driverRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 8,
    alignItems: "center",
  },
  driverFeature: { fontSize: 12, color: COLORS.text },
  driverTag: {
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid",
    whiteSpace: "nowrap",
  },
  driverImpact: {
    fontSize: 11,
    color: COLORS.subtext,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },

  smallMuted2: { marginTop: 10, fontSize: 12, color: COLORS.subtext },

  // Modal styles
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  },
  modal: {
    width: "min(720px, 96vw)",
    background: "white",
    border: `1px solid ${COLORS.cardBorder}`,
    borderRadius: 16,
    boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    borderBottom: `1px solid ${COLORS.cardBorder}`,
  },
  modalTitle: { fontWeight: 900, fontSize: 14, color: COLORS.text },
  modalClose: {
    border: `1px solid ${COLORS.cardBorder}`,
    background: "white",
    borderRadius: 10,
    padding: "6px 10px",
    cursor: "pointer",
  },
  modalBody: { padding: 16, color: COLORS.text },

  modalP: {
    margin: "8px 0",
    color: COLORS.subtext,
    fontSize: 13,
    lineHeight: 1.5,
  },
  modalUl: {
    margin: "8px 0 0",
    color: COLORS.subtext,
    fontSize: 13,
    lineHeight: 1.6,
  },
};