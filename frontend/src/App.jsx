import { useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const rows = data?.predictions || [];
  const kpis = data?.kpis || null;

  const filteredRows = useMemo(() => {
    if (riskFilter === "all") return rows;
    return rows.filter((r) => r.risk_tier === riskFilter);
  }, [rows, riskFilter]);

  const riskCounts = useMemo(() => {
    const counts = { high: 0, moderate: 0, low: 0 };
    rows.forEach((r) => {
      if (counts[r.risk_tier] !== undefined) counts[r.risk_tier]++;
    });
    return counts;
  }, [rows]);

  function downloadCSV() {
    if (!filteredRows.length) return;

    const headers = Object.keys(filteredRows[0]).filter((k) => k !== "top_drivers");
    const csv = [
      headers.join(","),
      ...filteredRows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
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
      {/* HERO */}
      <div style={styles.hero}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 22px" }}>
          <div style={styles.badgeRow}>
            <span style={styles.badge}>ML + FastAPI</span>
            <span style={styles.badgeMuted}>Logistic Regression</span>
          </div>

          <h1 style={styles.title}>Customer Churn InsightLab</h1>
          <p style={styles.subtitle}>
            Upload customer data → churn probability + risk tier + KPIs
          </p>

          {/* Controls */}
          <div style={styles.controls}>
            <div style={styles.fileWrap}>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
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
            </div>
          </div>

          {error && <div style={styles.errorBox}>⚠️ {error}</div>}
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        <div style={styles.grid}>
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

        <div style={styles.split}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.h2}>Predictions</h2>
                <div style={styles.muted}>
                  Showing {filteredRows.length} row(s) (limit {limit})
                </div>
              </div>

              {rows.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <MiniStat label="High" value={riskCounts.high} tone="high" />
                  <MiniStat label="Moderate" value={riskCounts.moderate} tone="moderate" />
                  <MiniStat label="Low" value={riskCounts.low} tone="low" />
                </div>
              )}
            </div>

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
                        <td style={styles.td}>{Number(r.churn_probability).toFixed(3)}</td>
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

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Tip: Increase rows to 200 if you want more results (API response is limited on purpose).
            </div>
          </div>
        </div>
      </div>
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

function MiniStat({ label, value, tone }) {
  return (
    <div style={styles.miniStat}>
      <span style={{ ...styles.dot, ...dotFor(tone) }} />
      <span style={{ fontSize: 12, opacity: 0.75 }}>{label}</span>
      <span style={{ fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function DriverList({ drivers }) {
  if (!Array.isArray(drivers) || drivers.length === 0) return <span style={{ opacity: 0.7 }}>—</span>;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {drivers.map((d, i) => (
        <div key={i} style={styles.driverRow}>
          <span style={styles.driverFeature}>{d.feature}</span>
          <span style={{ ...styles.driverTag, ...tagFor(d.direction) }}>
            {d.direction === "increases_churn" ? "↑ churn" : "↓ churn"}
          </span>
          <span style={styles.driverImpact}>{d.impact}</span>
        </div>
      ))}
    </div>
  );
}

function pillFor(tier) {
  if (tier === "high") return { background: "#2a0f10", borderColor: "#ff6b6b", color: "#ffd7d7" };
  if (tier === "moderate") return { background: "#2a210f", borderColor: "#f6c453", color: "#ffe9bf" };
  return { background: "#0f2a14", borderColor: "#4ade80", color: "#c9f7d6" };
}

function dotFor(tone) {
  if (tone === "high") return { background: "#ff6b6b" };
  if (tone === "moderate") return { background: "#f6c453" };
  return { background: "#4ade80" };
}

function tagFor(direction) {
  if (direction === "increases_churn") return { background: "#2a0f10", borderColor: "#ff6b6b", color: "#ffd7d7" };
  return { background: "#0f2a14", borderColor: "#4ade80", color: "#c9f7d6" };
}

const styles = {
  page: {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "#0b0b0c",
    minHeight: "100vh",
    color: "#eaeaea",
  },
  hero: {
    background: "radial-gradient(1200px 600px at 10% 10%, #1a1a1d 0%, #0b0b0c 60%)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  badgeRow: { display: "flex", gap: 8, marginBottom: 10 },
  badge: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.14)",
  },
  badgeMuted: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    opacity: 0.85,
  },
  title: { margin: 0, fontSize: 54, letterSpacing: -1 },
  subtitle: { margin: "8px 0 0", opacity: 0.8, fontSize: 16 },

  controls: {
    marginTop: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 14,
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 12,
    alignItems: "center",
  },
  fileWrap: { display: "flex", flexDirection: "column" },

  primaryBtn: {
    background: "#ffffff",
    color: "#0b0b0c",
    border: "none",
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "transparent",
    color: "#eaeaea",
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  rightControls: { display: "flex", gap: 10, alignItems: "end", justifyContent: "end" },
  label: { fontSize: 12, opacity: 0.75, marginBottom: 6 },
  select: {
    background: "rgba(255,255,255,0.08)",
    color: "#eaeaea",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10,
    padding: "10px 10px",
  },
  errorBox: {
    marginTop: 12,
    background: "rgba(255, 80, 80, 0.12)",
    border: "1px solid rgba(255, 80, 80, 0.35)",
    padding: 12,
    borderRadius: 12,
    color: "#ffd7d7",
  },

  main: { maxWidth: 1100, margin: "0 auto", padding: "18px 22px 40px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 },

  kpiCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 16,
  },
  kpiLabel: { fontSize: 12, opacity: 0.75 },
  kpiValue: { fontSize: 34, fontWeight: 900, marginTop: 6, letterSpacing: -0.5 },
  kpiHint: { fontSize: 12, opacity: 0.65, marginTop: 6 },

  split: { display: "grid", gridTemplateColumns: "1fr", gap: 12 },

  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 14,
  },
  cardHeader: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end" },
  h2: { margin: 0, fontSize: 18 },
  muted: { fontSize: 12, opacity: 0.65, marginTop: 4 },

  tableWrap: {
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  table: { width: "100%", borderCollapse: "collapse", background: "rgba(0,0,0,0.15)" },
  th: {
    textAlign: "left",
    padding: "12px 12px",
    fontSize: 12,
    letterSpacing: 0.2,
    opacity: 0.85,
    background: "rgba(255,255,255,0.06)",
    borderBottom: "1px solid rgba(255,255,255,0.10)",
  },
  td: { padding: "12px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", fontSize: 13 },
  tdMono: {
    padding: "12px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    fontSize: 13,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  rowAlt: { background: "rgba(255,255,255,0.03)" },

  pill: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "capitalize",
  },

  predBad: { fontWeight: 800, color: "#ffb3b3" },
  predGood: { fontWeight: 800, color: "#b9ffcf" },

  miniStat: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  dot: { width: 10, height: 10, borderRadius: 99 },

  driverRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: 8,
    alignItems: "center",
  },
  driverFeature: { fontSize: 12, opacity: 0.9 },
  driverTag: {
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid",
    whiteSpace: "nowrap",
  },
  driverImpact: {
    fontSize: 11,
    opacity: 0.75,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
};