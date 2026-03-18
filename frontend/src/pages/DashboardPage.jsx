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

  const shelves = shelfMap?.shelves || ["A", "B", "C", "D"];
  const levels = shelfMap?.levels || [1, 2, 3, 4, 5, 6];
  const slotByCode = (shelfMap?.slots || []).reduce((acc, slot) => {
    acc[slot.location_code] = slot;
    return acc;
  }, {});

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
        <h3 style={{ margin: 0 }}>Shelf Map</h3>
        <p style={styles.shelfHint}>A-D shelves (left to right), levels 1-6.</p>

        {shelfMap && (
          <div style={styles.mapScroll}>
            <div style={styles.mapWrap(isPhone)}>
              <div style={styles.matrixHeaderRow}>
                <div style={styles.matrixCorner} />
                {shelves.map((shelf) => (
                  <div key={shelf} style={styles.matrixHeaderCell}>{shelf}</div>
                ))}
              </div>

              {levels.map((level) => (
                <div key={level} style={styles.matrixRow}>
                  <div style={styles.matrixRowLabel}>{level}</div>
                  {shelves.map((shelf) => {
                    const slot = slotByCode[`${shelf}${level}`] || {
                      available_total: 0,
                      title_entries: [],
                    };

                    return (
                      <div key={`${shelf}${level}`} style={styles.slot}>
                        <div style={styles.slotBody}>
                          <div style={styles.slotCount}>
                            {slot.available_total} cop{slot.available_total === 1 ? "y" : "ies"}
                          </div>
                          {slot.title_entries.length > 0 ? (
                            <ul style={styles.slotTitles}>
                              {slot.title_entries.slice(0, 2).map((entry) => (
                                <li key={`${shelf}${level}-${entry.title}`} style={styles.slotTitleRow}>
                                  <span style={styles.slotTitleText}>{entry.title}</span>
                                  <span style={styles.titleCopies}>x{entry.copies}</span>
                                </li>
                              ))}
                              {slot.title_entries.length > 2 && (
                                <li style={styles.slotMore}>+{slot.title_entries.length - 2} more</li>
                              )}
                            </ul>
                          ) : (
                            <div style={styles.slotEmpty}>Empty</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
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
  shelfSection: { marginTop:"1.5rem", background:"#fff", borderRadius:"10px", border:"1px solid #e5e7eb", padding:"1rem" },
  shelfHint: { marginTop:"0.35rem", color:"#64748b", fontSize:"0.85rem" },
  mapScroll: { marginTop:"0.8rem", overflowX:"auto", paddingBottom:"0.15rem" },
  mapWrap: (isPhone) => ({
    minWidth: isPhone ? "500px" : "100%",
  }),
  matrixHeaderRow: { display:"grid", gridTemplateColumns:"44px repeat(4, minmax(96px, 1fr))", gap:"0.5rem", marginBottom:"0.5rem" },
  matrixCorner: { height:"1px" },
  matrixHeaderCell: { textAlign:"center", color:"#0f172a", fontSize:"0.78rem", fontWeight:"700" },
  matrixRow: { display:"grid", gridTemplateColumns:"44px repeat(4, minmax(96px, 1fr))", gap:"0.5rem", marginBottom:"0.5rem", alignItems:"stretch" },
  matrixRowLabel: { display:"flex", alignItems:"center", justifyContent:"center", color:"#334155", fontSize:"0.78rem", fontWeight:"700" },
  slot: { border:"1px solid #e2e8f0", borderRadius:"8px", background:"#ffffff" },
  slotBody: { padding:"0.42rem", minHeight:"72px" },
  slotCount: { color:"#2563eb", fontSize:"0.72rem", fontWeight:"700" },
  slotTitles: { margin:0, padding:0, listStyle:"none", color:"#475569", fontSize:"0.7rem", lineHeight:1.35 },
  slotTitleRow: { display:"flex", justifyContent:"space-between", gap:"0.35rem" },
  slotTitleText: { overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  titleCopies: { color:"#1d4ed8", fontWeight:"700", flexShrink:0 },
  slotMore: { color:"#64748b", marginTop:"0.1rem" },
  slotEmpty: { color:"#94a3b8", fontSize:"0.7rem", fontStyle:"italic" },
};
