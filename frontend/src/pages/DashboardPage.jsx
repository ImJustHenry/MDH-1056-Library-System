import { useEffect, useState } from "react";
import api from "../api/client";

export default function DashboardPage() {
  const [stats,   setStats]   = useState(null);
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard")
      .then(({ data }) => setStats(data))
      .catch(() => setError("Failed to load dashboard."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading…</p>;
  if (error)   return <p style={{ color:"#c00" }}>{error}</p>;

  const cards = [
    { label:"Total Titles",         value: stats.total_titles,          color:"#003087" },
    { label:"Total Copies",         value: stats.total_copies,          color:"#0057b7" },
    { label:"Available Copies",     value: stats.available_copies,      color:"#080"    },
    { label:"Checked Out Copies",   value: stats.checked_out_copies,    color:"#c00"    },
    { label:"Active Checkouts",     value: stats.active_checkouts,      color:"#e67e00" },
    { label:"Verified Users",       value: stats.total_verified_users,  color:"#555"    },
  ];

  return (
    <div>
      <h2>Dashboard</h2>
      <div style={styles.grid}>
        {cards.map(c => (
          <div key={c.label} style={styles.card}>
            <div style={{ ...styles.value, color: c.color }}>{c.value}</div>
            <div style={styles.label}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  grid:  { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",
           gap:"1rem", marginTop:"1rem" },
  card:  { background:"#fff", padding:"1.5rem", borderRadius:"8px",
           boxShadow:"0 2px 8px rgba(0,0,0,0.08)", textAlign:"center" },
  value: { fontSize:"2.5rem", fontWeight:"bold", lineHeight:1 },
  label: { marginTop:"0.5rem", color:"#666", fontSize:"0.9rem" },
};
