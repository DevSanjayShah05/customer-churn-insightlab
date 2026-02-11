import { useEffect, useState } from "react";

const API_BASE = "http://127.0.0.1:8000";

export default function App() {
  const [health, setHealth] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 24 }}>
      <h1>Churn InsightLab</h1>
      <p>Backend health check:</p>
      {err ? <pre>{err}</pre> : <pre>{JSON.stringify(health, null, 2)}</pre>}
    </div>
  );
}