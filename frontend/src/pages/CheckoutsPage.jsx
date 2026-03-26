import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { SHELF_COLUMNS, SHELF_LEVELS } from "../constants/shelfLocations";

export default function CheckoutsPage() {
  const { user } = useAuth();
  const [isPhone, setIsPhone] = useState(window.innerWidth <= 820);
  const [checkouts, setCheckouts] = useState([]);
  const [filter,    setFilter]    = useState("");
  const [error,     setError]     = useState("");
  const [msg,       setMsg]       = useState("");
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnShelf, setReturnShelf] = useState("A");
  const [returnLevel, setReturnLevel] = useState("1");

  const fetchCheckouts = async (status = "") => {
    const params = status ? { status } : {};
    try {
      const { data } = await api.get("/checkouts", { params });
      setCheckouts(data);
    } catch {
      setError("Failed to load checkouts.");
    }
  };

  useEffect(() => { fetchCheckouts(); }, []);

  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth <= 820);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const openReturnPopup = (checkout) => {
    setReturnTarget(checkout);
    const location = (checkout.book_location || "A1").toUpperCase();
    const shelf = SHELF_COLUMNS.includes(location.charAt(0)) ? location.charAt(0) : "A";
    const level = String(Number(location.charAt(1)) || 1);
    setReturnShelf(shelf);
    setReturnLevel(SHELF_LEVELS.map(String).includes(level) ? level : "1");
  };

  const handleReturn = async () => {
    if (!returnTarget) return;
    setMsg(""); setError("");
    const returnLocation = `${returnShelf}${returnLevel}`;
    try {
      const { data } = await api.post(`/checkouts/${returnTarget.id}/return`, {
        location_code: returnLocation,
      });
      setMsg(`${data.message} Shelved at ${returnLocation}.`);
      setReturnTarget(null);
      fetchCheckouts(filter);
    } catch (err) {
      setError(err.response?.data?.error || "Return failed.");
    }
  };

  const handleFilter = (val) => {
    setFilter(val);
    fetchCheckouts(val);
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : "—";

  return (
    <div>
      <h2>{user.role === "admin" ? "All Checkouts" : "My Checkouts"}</h2>

      <div style={styles.filterRow}>
        {["", "active", "returned"].map(v => (
          <button key={v} style={filter === v ? styles.btnActive : styles.btnOutline}
            onClick={() => handleFilter(v)}>
            {v === "" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {msg   && <p style={styles.success}>{msg}</p>}
      {error && <p style={styles.error}>{error}</p>}

      {isPhone ? (
        <div style={styles.mobileList}>
          {checkouts.length === 0 && <div style={styles.mobileEmpty}>No checkouts found.</div>}
          {checkouts.map((c) => (
            <div key={c.id} style={styles.mobileCard}>
              <div style={styles.mobileTitle}>{c.book_title}</div>
              {user.role === "admin" && <div style={styles.mobileMeta}>User: {c.user_email}</div>}
              <div style={styles.mobileRow}>
                <span style={styles.mobileLabel}>Location</span>
                <span style={styles.locationTag}>{c.book_location || "—"}</span>
              </div>
              <div style={styles.mobileRow}>
                <span style={styles.mobileLabel}>Checked Out</span>
                <span>{fmt(c.checked_out_at)}</span>
              </div>
              <div style={styles.mobileRow}>
                <span style={styles.mobileLabel}>Returned</span>
                <span>{fmt(c.returned_at)}</span>
              </div>
              <div style={styles.mobileRow}>
                <span style={styles.mobileLabel}>Status</span>
                <span style={c.status === "active" ? styles.active : styles.returned}>{c.status}</span>
              </div>
              {c.status === "active" && (
                <div style={{ marginTop:"0.55rem" }}>
                  <button style={styles.btn} onClick={() => openReturnPopup(c)}>Return</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.header}>
              <th>Book</th>
              {user.role === "admin" && <th>User</th>}
              <th>Location</th>
              <th>Checked Out</th>
              <th>Returned</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {checkouts.length === 0 && (
              <tr><td colSpan={user.role === "admin" ? 7 : 6} style={{textAlign:"center",padding:"1rem",color:"#888"}}>
                No checkouts found.
              </td></tr>
            )}
            {checkouts.map(c => (
              <tr key={c.id} style={styles.row}>
                <td>{c.book_title}</td>
                {user.role === "admin" && <td style={{fontSize:"0.85rem"}}>{c.user_email}</td>}
                <td><span style={styles.locationTag}>{c.book_location || "—"}</span></td>
                <td>{fmt(c.checked_out_at)}</td>
                <td>{fmt(c.returned_at)}</td>
                <td>
                  <span style={c.status === "active" ? styles.active : styles.returned}>
                    {c.status}
                  </span>
                </td>
                <td>
                  {c.status === "active" && (
                    <button style={styles.btn} onClick={() => openReturnPopup(c)}>
                      Return
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {returnTarget && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <h3 style={{ marginTop: 0, marginBottom: "0.6rem" }}>Return Book</h3>
            <p style={{ marginTop: 0, color: "#555", fontSize: "0.92rem" }}>
              Where did you place <strong>{returnTarget.book_title}</strong>?
            </p>
            <div style={styles.returnSelectors}>
              <div style={{ flex: 1 }}>
                <label style={styles.selectLabel}>Shelf</label>
                <select
                  style={styles.select}
                  value={returnShelf}
                  onChange={(e) => setReturnShelf(e.target.value)}
                >
                  {SHELF_COLUMNS.map((shelf) => (
                    <option key={shelf} value={shelf}>{shelf}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.selectLabel}>Height</label>
                <select
                  style={styles.select}
                  value={returnLevel}
                  onChange={(e) => setReturnLevel(e.target.value)}
                >
                  {SHELF_LEVELS.map((level) => (
                    <option key={level} value={String(level)}>{level}</option>
                  ))}
                </select>
              </div>
            </div>
            <p style={{ marginTop: "0.65rem", color: "#334155", fontSize: "0.88rem" }}>
              Selected location: <strong>{returnShelf}{returnLevel}</strong>
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <button style={styles.btnOutline} onClick={() => setReturnTarget(null)}>Cancel</button>
              <button style={styles.btn} onClick={handleReturn}>Confirm Return</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  filterRow: { display:"flex", gap:"0.5rem", marginBottom:"1rem" },
  btn:       { padding:"0.4rem 0.9rem", background:"#003087", color:"#fff",
               border:"none", borderRadius:"4px", cursor:"pointer", fontSize:"0.9rem" },
  btnOutline:{ padding:"0.4rem 0.9rem", background:"#fff", color:"#003087",
               border:"1px solid #003087", borderRadius:"4px", cursor:"pointer" },
  btnActive: { padding:"0.4rem 0.9rem", background:"#003087", color:"#fff",
               border:"1px solid #003087", borderRadius:"4px", cursor:"pointer" },
  mobileList: { display:"grid", gap:"0.7rem" },
  mobileCard: { border:"1px solid #e5e7eb", borderRadius:10, background:"#fff", padding:"0.75rem" },
  mobileTitle: { fontSize:"0.95rem", fontWeight:"700", color:"#0f172a", marginBottom:"0.2rem" },
  mobileMeta: { fontSize:"0.82rem", color:"#64748b", marginBottom:"0.2rem", wordBreak:"break-word" },
  mobileRow: { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"0.5rem", marginTop:"0.35rem" },
  mobileLabel: { fontSize:"0.8rem", color:"#475569", fontWeight:"600" },
  mobileEmpty: { textAlign:"center", color:"#888", padding:"1rem", border:"1px dashed #d1d5db", borderRadius:8 },
  table:    { width:"100%", borderCollapse:"collapse" },
  header:   { background:"#f0f4f8", textAlign:"left" },
  row:      { borderBottom:"1px solid #eee" },
  locationTag: { background:"#e8f0fe", color:"#003087", padding:"2px 8px",
                 borderRadius:"12px", fontSize:"0.85rem", fontWeight:"600" },
  active:   { background:"#fff3cd", color:"#856404", padding:"2px 8px",
              borderRadius:"12px", fontSize:"0.85rem" },
  returned: { background:"#eaffea", color:"#080", padding:"2px 8px",
              borderRadius:"12px", fontSize:"0.85rem" },
  success:  { background:"#eaffea", color:"#080", padding:"0.6rem",
              borderRadius:"4px", marginBottom:"0.5rem" },
  error:    { background:"#ffeaea", color:"#c00", padding:"0.6rem",
              borderRadius:"4px", marginBottom:"0.5rem" },
  modalBackdrop: { position:"fixed", inset:0, background:"rgba(0,0,0,0.35)",
                   display:"flex", alignItems:"center", justifyContent:"center", zIndex:300 },
  modalCard: { background:"#fff", borderRadius:"8px", width:"100%", maxWidth:"420px",
               padding:"1rem", boxShadow:"0 12px 32px rgba(0,0,0,0.24)", margin:"0 1rem" },
  returnSelectors: { display:"flex", gap:"0.6rem" },
  selectLabel: { display:"block", marginBottom:"0.35rem", color:"#334155", fontSize:"0.85rem", fontWeight:"600" },
  select: { width:"100%", padding:"0.55rem 0.75rem", border:"1px solid #ccc",
            borderRadius:"4px", fontSize:"0.95rem" },
};
