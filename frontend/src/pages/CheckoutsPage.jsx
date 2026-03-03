import { useEffect, useState } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function CheckoutsPage() {
  const { user } = useAuth();
  const [checkouts, setCheckouts] = useState([]);
  const [filter,    setFilter]    = useState("");
  const [error,     setError]     = useState("");
  const [msg,       setMsg]       = useState("");

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

  const handleReturn = async (checkoutId) => {
    setMsg(""); setError("");
    try {
      const { data } = await api.post(`/checkouts/${checkoutId}/return`);
      setMsg(data.message);
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

      <table style={styles.table}>
        <thead>
          <tr style={styles.header}>
            <th>Book</th>
            {user.role === "admin" && <th>User</th>}
            <th>Checked Out</th>
            <th>Returned</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {checkouts.length === 0 && (
            <tr><td colSpan={6} style={{textAlign:"center",padding:"1rem",color:"#888"}}>
              No checkouts found.
            </td></tr>
          )}
          {checkouts.map(c => (
            <tr key={c.id} style={styles.row}>
              <td>{c.book_title}</td>
              {user.role === "admin" && <td style={{fontSize:"0.85rem"}}>{c.user_email}</td>}
              <td>{fmt(c.checked_out_at)}</td>
              <td>{fmt(c.returned_at)}</td>
              <td>
                <span style={c.status === "active" ? styles.active : styles.returned}>
                  {c.status}
                </span>
              </td>
              <td>
                {c.status === "active" && (
                  <button style={styles.btn} onClick={() => handleReturn(c.id)}>
                    Return
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
  table:    { width:"100%", borderCollapse:"collapse" },
  header:   { background:"#f0f4f8", textAlign:"left" },
  row:      { borderBottom:"1px solid #eee" },
  active:   { background:"#fff3cd", color:"#856404", padding:"2px 8px",
              borderRadius:"12px", fontSize:"0.85rem" },
  returned: { background:"#eaffea", color:"#080", padding:"2px 8px",
              borderRadius:"12px", fontSize:"0.85rem" },
  success:  { background:"#eaffea", color:"#080", padding:"0.6rem",
              borderRadius:"4px", marginBottom:"0.5rem" },
  error:    { background:"#ffeaea", color:"#c00", padding:"0.6rem",
              borderRadius:"4px", marginBottom:"0.5rem" },
};
