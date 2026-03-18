import { useEffect, useState } from "react";
import api from "../api/client";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [shelfMap, setShelfMap] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPhone, setIsPhone] = useState(window.innerWidth <= 680);

  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth <= 680);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    Promise.all([api.get("/dashboard"), api.get("/dashboard/shelf-map")])
      .then(([statsRes, shelfMapRes]) => {
        setStats(statsRes.data);
        setShelfMap(shelfMapRes.data);
      })
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

      <div style={styles.shelfSection}>
        <h3 style={{ margin: 0 }}>Shelf Map (A-D x 1-6)</h3>
        <p style={styles.shelfHint}>
          Example: <strong>A3</strong> means column A (left-most shelf), level 3.
        </p>

        {shelfMap && (
          <div style={styles.mapWrap(isPhone)}>
            {shelfMap.slots.map((slot) => (
              <div key={slot.location_code} style={styles.slot}>
                <div style={styles.slotHead}>{slot.location_code}</div>
                <div style={styles.slotBody}>
                  <div style={styles.slotCount}>
                    {slot.available_total} cop{slot.available_total === 1 ? "y" : "ies"}
                  </div>
                  {slot.titles.length > 0 ? (
                    <ul style={styles.slotTitles}>
                      {slot.titles.slice(0, 3).map((title) => (
                        <li key={`${slot.location_code}-${title}`}>{title}</li>
                      ))}
                      {slot.titles.length > 3 && <li>+{slot.titles.length - 3} more</li>}
                    </ul>
                  ) : (
                    <div style={styles.slotEmpty}>Empty</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  grid: { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:"1rem", marginTop:"1rem" },
  card: { background:"#fff", padding:"1.5rem", borderRadius:"8px", boxShadow:"0 2px 8px rgba(0,0,0,0.08)", textAlign:"center" },
  value: { fontSize:"2.5rem", fontWeight:"bold", lineHeight:1 },
  label: { marginTop:"0.5rem", color:"#666", fontSize:"0.9rem" },
  shelfSection: { marginTop:"1.5rem", background:"#fff", borderRadius:"8px", boxShadow:"0 2px 8px rgba(0,0,0,0.08)", padding:"1rem" },
  shelfHint: { marginTop:"0.35rem", color:"#555", fontSize:"0.9rem" },
  mapWrap: (isPhone) => ({
    marginTop:"0.75rem",
    display:"grid",
    gridTemplateColumns: isPhone ? "repeat(4, minmax(68px, 1fr))" : "repeat(4, minmax(130px, 1fr))",
    gap: isPhone ? "0.35rem" : "0.6rem",
  }),
  slot: { border:"1px solid #dbe3f0", borderRadius:"8px", overflow:"hidden", background:"#f9fbff" },
  slotHead: { background:"#e8f0fe", color:"#003087", padding:"0.3rem 0.4rem", fontWeight:"700", fontSize:"0.78rem" },
  slotBody: { padding:"0.4rem", minHeight:"72px" },
  slotCount: { color:"#334155", fontSize:"0.72rem", fontWeight:"600", marginBottom:"0.2rem" },
  slotTitles: { margin:0, paddingLeft:"0.85rem", color:"#475569", fontSize:"0.7rem", lineHeight:1.35 },
  slotEmpty: { color:"#94a3b8", fontSize:"0.7rem", fontStyle:"italic" },
};
