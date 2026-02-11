import { useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

export default function App() {
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [riskFilter, setRiskFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onPredict() {
    setError("");
    setData(null);

    if (!file) {
      setError("Please upload a CSV file first.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${API_BASE}/predict/churn`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(String(e));
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

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0 }}>Customer Churn InsightLab</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.8 }}>
            Upload customer data → churn probability + risk tier + KPIs
          </p>
        </div>
      </header>

      <section style={styles.card}>
        <div style={styles.row}>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button onClick={onPredict} disabled={loading} style={styles.button}>
            {loading ? "Predicting..." : "Upload & Predict"}
          </button>

          <div style={{ marginLeft: "auto" }}>
            <label style={{ marginRight: 8, opacity: 0.8 }}>Filter:</label>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="moderate">Moderate</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {error && <div style={styles.error}><b>Error:</b> {error}</div>}
      </section>

      {kpis && (
        <section style={styles.kpiGrid}>
          <KpiCard label="Total customers" value={kpis.total_customers} />
          <KpiCard label="Predicted churners" value={kpis.predicted_churners} />
          <KpiCard label="Predicted churn rate" value={`${(kpis.predicted_churn_rate * 100).toFixed(1)}%`} />
        </section>
      )}

      {rows.length > 0 && (
        <section style={styles.card}>
          <h2 style={{ marginTop: 0 }}>Predictions</h2>
          <p style={{ marginTop: 6, opacity: 0.7 }}>
            Showing {Math.min(filteredRows.length, 50)} of {filteredRows.length} (filtered)
          </p>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {"customerID" in filteredRows[0] && <th style={styles.th}>Customer ID</th>}
                  <th style={styles.th}>Churn Probability</th>
                  <th style={styles.th}>Prediction</th>
                  <th style={styles.th}>Risk Tier</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.slice(0, 50).map((r, idx) => (
                  <tr key={idx}>
                    {"customerID" in r && <td style={styles.td}>{r.customerID}</td>}
                    <td style={styles.td}>{Number(r.churn_probability).toFixed(3)}</td>
                    <td style={styles.td}>{r.churn_prediction === 1 ? "Churn" : "No churn"}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.pill, ...pillFor(r.risk_tier) }}>
                        {r.risk_tier}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCard({ label, value }) {
  return (
    <div style={styles.kpiCard}>
      <div style={{ opacity: 0.75, fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function pillFor(tier) {
  if (tier === "high") return { background: "#ffe5e5", borderColor: "#ffb3b3" };
  if (tier === "moderate") return { background: "#fff4d6", borderColor: "#ffd27a" };
  return { background: "#e7ffe9", borderColor: "#9ce6a3" };
}

const styles = {
  page: { fontFamily: "system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  row: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" },
  card: { background: "white", border: "1px solid #eee", borderRadius: 12, padding: 16, marginBottom: 16 },
  button: { padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", cursor: "pointer" },
  error: { marginTop: 12, background: "#ffe5e5", padding: 10, borderRadius: 10 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 },
  kpiCard: { background: "white", border: "1px solid #eee", borderRadius: 12, padding: 16 },
  tableWrap: { overflowX: "auto", border: "1px solid #eee", borderRadius: 12 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: 10, background: "#fafafa", borderBottom: "1px solid #eee" },
  td: { padding: 10, borderBottom: "1px solid #f2f2f2" },
  pill: { display: "inline-block", padding: "4px 10px", borderRadius: 999, border: "1px solid", fontSize: 12, fontWeight: 700 },
};