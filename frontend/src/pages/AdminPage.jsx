import { useEffect, useState } from "react";
import api from "../api/client";
import { SHELF_OPTIONS } from "../constants/shelfLocations";

export default function AdminPage() {
  const [tab,       setTab]       = useState("books");
  const [books,     setBooks]     = useState([]);
  const [logs,      setLogs]      = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [error,     setError]     = useState("");
  const [msg,       setMsg]       = useState("");

  // Add book form
  const [form, setForm] = useState({ title:"", author:"", isbn:"", total_copies:1, location_code:"A1" });

  // Edit book modal
  const [editingBook,  setEditingBook]  = useState(null);
  const [editForm,     setEditForm]     = useState({});

  // Admin checkout form
  const [selectedBooks, setSelectedBooks] = useState([]);   // [{id, title, author}]
  const [userEmail,     setUserEmail]     = useState("");
  const [bookSearch,    setBookSearch]    = useState("");
  const [bookDropdown,  setBookDropdown]  = useState(false);
  const [hoveredBookId, setHoveredBookId] = useState(null);

  const fetchBooks = async () => {
    try { const { data } = await api.get("/books"); setBooks(data); }
    catch { setError("Failed to load books."); }
  };
  const fetchLogs = async () => {
    try { const { data } = await api.get("/logs"); setLogs(data.logs); }
    catch { setError("Failed to load logs."); }
  };
  const fetchCheckouts = async () => {
    try { const { data } = await api.get("/checkouts/active"); setCheckouts(data); }
    catch { setError("Failed to load checkouts."); }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const switchTab = (t) => {
    setTab(t); setError(""); setMsg("");
    if (t === "logs")      fetchLogs();
    if (t === "checkouts") fetchCheckouts();
  };

  const handleAddBook = async (e) => {
    e.preventDefault(); setError(""); setMsg("");
    try {
      await api.post("/books", { ...form, total_copies: Number(form.total_copies) });
      setMsg("Book added successfully.");
      setForm({ title:"", author:"", isbn:"", total_copies:1, location_code:"A1" });
      fetchBooks();
    } catch (err) {
      if (err.response?.status === 409 && /isbn/i.test(err.response?.data?.error || "")) {
        setError("There is duplicate ISBN.");
      } else {
        setError(err.response?.data?.error || "Failed to add book.");
      }
    }
  };

  const handleEditBook = (book) => {
    setError(""); setMsg("");
    setEditingBook(book);
    setEditForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn || "",
      total_copies: book.total_copies,
      location_code: book.location_code,
      description: book.description || "",
    });
  };

  const handleSaveEdit = async () => {
    setError(""); setMsg("");
    if (!editForm.title || !editForm.author) {
      setError("Title and author are required.");
      return;
    }
    if (!Number.isInteger(Number(editForm.total_copies)) || Number(editForm.total_copies) < 1) {
      setError("Stock must be an integer greater than or equal to 1.");
      return;
    }
    try {
      await api.put(`/books/${editingBook.id}`, {
        title: editForm.title,
        author: editForm.author,
        isbn: editForm.isbn,
        total_copies: Number(editForm.total_copies),
        location_code: editForm.location_code,
        description: editForm.description,
      });
      setMsg("Book updated successfully.");
      setEditingBook(null);
      setEditForm({});
      fetchBooks();
    } catch (err) {
      if (err.response?.status === 409 && /isbn/i.test(err.response?.data?.error || "")) {
        setError("There is duplicate ISBN.");
      } else {
        setError(err.response?.data?.error || "Failed to update book.");
      }
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    setError(""); setMsg("");
    try {
      const { data } = await api.delete(`/books/${id}`);
      setMsg(data.message);
      fetchBooks();
    } catch (err) { setError(err.response?.data?.error || "Delete failed."); }
  };

  const handleAdminCheckout = async (e) => {
    e.preventDefault(); setError(""); setMsg("");
    if (selectedBooks.length === 0) { setError("Select at least one book."); return; }
    const lines = selectedBooks.map((b) => `• ${b.title} → ${locationSummary(b)}`);
    const proceed = window.confirm(
      `Shelf locations for pickup:\n\n${lines.join("\n")}\n\nContinue checkout for ${userEmail}?`
    );
    if (!proceed) return;
    try {
      const results = await Promise.allSettled(
        selectedBooks.map(b =>
          api.post("/checkouts/admin-checkout", { book_id: b.id, user_email: userEmail })
        )
      );
      const failed  = results.filter(r => r.status === "rejected");
      const success = results.filter(r => r.status === "fulfilled");
      if (failed.length === 0) {
        setMsg(`${success.length} book(s) checked out successfully.`);
      } else {
        setMsg(`${success.length} checked out.`);
        setError(`${failed.length} failed: ${failed.map(f => f.reason?.response?.data?.error || "error").join(", ")}`);
      }
      setSelectedBooks([]); setUserEmail(""); setBookSearch("");
      fetchCheckouts();
    } catch (err) { setError(err.response?.data?.error || "Checkout failed."); }
  };

  const bookResults = books.filter(b =>
    b.available_copies > 0 &&
    !selectedBooks.find(s => s.id === b.id) &&
    (b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
     b.author.toLowerCase().includes(bookSearch.toLowerCase()))
  );

  const locationSummary = (book) => {
    const counts = book.location_counts || {};
    const entries = Object.entries(counts).filter(([, count]) => Number(count) > 0);
    if (entries.length === 0) return book.location_code || "Unknown";
    return entries
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => `${code}:${count}`)
      .join(", ");
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : "—";

  const tabStyle = (t) => ({
    padding:"0.5rem 1.25rem", cursor:"pointer", border:"none",
    borderBottom: tab === t ? "3px solid #003087" : "3px solid transparent",
    background:"transparent", fontWeight: tab === t ? "bold" : "normal",
    color: tab === t ? "#003087" : "#555",
  });

  return (
    <div>
      <h2>Admin Panel</h2>

      {/* Tabs */}
      <div style={{ display:"flex", gap:"0.25rem", borderBottom:"1px solid #ddd", marginBottom:"1.5rem" }}>
        <button style={tabStyle("books")}     onClick={() => switchTab("books")}>Books</button>
        <button style={tabStyle("checkouts")} onClick={() => switchTab("checkouts")}>Active Checkouts</button>
        <button style={tabStyle("logs")}      onClick={() => switchTab("logs")}>Audit Log</button>
      </div>

      {msg   && <p style={styles.success}>{msg}</p>}
      {error && <p style={styles.error}>{error}</p>}

      {/* ── BOOKS TAB ────────────────────────────────────────────────── */}
      {tab === "books" && (
        <>
          <h3>Add Book</h3>
          <form onSubmit={handleAddBook} style={styles.form}>
            {[["Title","title","text",true],["Author","author","text",true],
              ["ISBN","isbn","text",false]].map(([label,key,type,req]) => (
              <input key={key} style={styles.input} type={type} placeholder={label}
                value={form[key]} required={req}
                onChange={e => setForm(f => ({...f, [key]: e.target.value}))} />
            ))}
            <input style={{...styles.input, width:"120px"}} type="number" min="1"
              placeholder="Copies" value={form.total_copies}
              onChange={e => setForm(f => ({...f, total_copies: e.target.value}))} />
            <select
              style={{ ...styles.input, width:"120px", flex:"none" }}
              value={form.location_code}
              onChange={e => setForm(f => ({ ...f, location_code: e.target.value }))}
            >
              {SHELF_OPTIONS.map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
            <button style={styles.btn} type="submit">Add Book</button>
          </form>

          <h3>All Books</h3>
          <input style={{...styles.input, marginBottom:"1rem", maxWidth:"300px"}} placeholder="Search…"
            onChange={e => { const q = e.target.value.toLowerCase();
              document.querySelectorAll("[data-book-row]").forEach(r => {
                r.style.display = r.dataset.title.toLowerCase().includes(q) ? "" : "none";
              }); }} />

          <table style={styles.table}>
            <thead>
              <tr style={styles.header}>
                <th>Title</th><th>Author</th><th>ISBN</th>
                <th>Location</th><th>Copies</th><th></th>
              </tr>
            </thead>
            <tbody>
              {books.map(b => (
                <tr key={b.id} style={styles.row} data-book-row="" data-title={b.title}>
                  <td>{b.title}</td>
                  <td>{b.author}</td>
                  <td style={{fontSize:"0.85rem",color:"#888"}}>{b.isbn || "—"}</td>
                  <td><span style={styles.badge}>{b.location_code || "—"}</span></td>
                  <td>
                    <span style={{
                      fontWeight:"600",
                      color: b.available_copies === 0 ? "#c00" : b.available_copies < b.total_copies ? "#b86000" : "#080"
                    }}>
                      {b.available_copies}/{b.total_copies}
                    </span>
                  </td>
                  <td>
                    <div style={styles.rowActions}>
                      <button style={styles.btnSecondary}
                        onClick={() => handleEditBook(b)}>Edit</button>
                      <button style={styles.btnDanger}
                        onClick={() => handleDelete(b.id, b.title)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Admin checkout on behalf of user */}
          <h3 style={{marginTop:"2rem"}}>Checkout Book(s) for User</h3>
          <form onSubmit={handleAdminCheckout}>

            {/* Book search combobox */}
            <div style={{position:"relative", marginBottom:"0.75rem"}}>
              <input
                style={{...styles.input, width:"100%", boxSizing:"border-box", marginBottom:0}}
                type="text"
                placeholder="Search available books…"
                value={bookSearch}
                onFocus={() => setBookDropdown(true)}
                onChange={e => { setBookSearch(e.target.value); setBookDropdown(true); }}
                onBlur={() => setTimeout(() => setBookDropdown(false), 150)}
                autoComplete="off"
              />
              {bookDropdown && bookSearch && (
                <ul style={styles.dropdown}>
                  {bookResults.length === 0 ? (
                    <li style={styles.dropItem}>No available books found</li>
                  ) : (
                    bookResults.map(b => (
                      <li key={b.id}
                        style={{...styles.dropItemHover,
                          background: hoveredBookId === b.id ? "#f0f4ff" : "#fff"}}
                        onMouseEnter={() => setHoveredBookId(b.id)}
                        onMouseLeave={() => setHoveredBookId(null)}
                        onMouseDown={() => {
                          setSelectedBooks(prev => [...prev, {
                            id: b.id,
                            title: b.title,
                            author: b.author,
                            location_code: b.location_code,
                            location_counts: b.location_counts,
                          }]);
                          setBookSearch("");
                          setBookDropdown(false);
                        }}>
                        <strong>{b.title}</strong>
                        <span style={{color:"#666", fontSize:"0.85rem"}}> — {b.author}</span>
                        <span style={{ marginLeft:"0.5rem", color:"#003087", fontSize:"0.8rem", fontWeight:"600" }}>
                          [{locationSummary(b)}]
                        </span>
                        <span style={{float:"right", fontSize:"0.8rem", color:"#888"}}>{b.available_copies} avail.</span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>

            {/* Selected books chips */}
            {selectedBooks.length > 0 && (
              <div style={styles.chipContainer}>
                {selectedBooks.map(b => (
                  <span key={b.id} style={styles.chip}>
                    <strong>{b.title}</strong>
                    <span style={{color:"#555", fontSize:"0.8rem"}}> — {b.author}</span>
                    <span style={{color:"#003087", fontSize:"0.78rem", fontWeight:"600"}}>[{locationSummary(b)}]</span>
                    <button type="button"
                      onClick={() => setSelectedBooks(prev => prev.filter(s => s.id !== b.id))}
                      style={styles.chipRemove}
                      title="Remove">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div style={{display:"flex", gap:"0.5rem", alignItems:"center", marginTop:"0.5rem"}}>
              <input style={{...styles.input, flex:1, marginBottom:0}} type="email"
                placeholder="User email (@slu.edu)"
                value={userEmail} required
                onChange={e => setUserEmail(e.target.value)} />
              <button style={{...styles.btn, whiteSpace:"nowrap"}}
                type="submit" disabled={selectedBooks.length === 0}>
                Checkout {selectedBooks.length > 1 ? `${selectedBooks.length} Books` : "Book"} for User
              </button>
            </div>
          </form>
        </>
      )}

      {/* ── EDIT MODAL ────────────────────────────────────────────── */}
      {editingBook && (
        <div style={styles.modalOverlay} onClick={() => setEditingBook(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{margin:"0 0 1rem"}}>Edit Book: {editingBook.title}</h3>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem", marginBottom:"1rem"}}>
              <div>
                <label style={styles.label}>Title</label>
                <input style={styles.modalInput} type="text" value={editForm.title}
                  onChange={e => setEditForm({...editForm, title: e.target.value})} />
              </div>
              <div>
                <label style={styles.label}>Author</label>
                <input style={styles.modalInput} type="text" value={editForm.author}
                  onChange={e => setEditForm({...editForm, author: e.target.value})} />
              </div>
              <div>
                <label style={styles.label}>ISBN</label>
                <input style={styles.modalInput} type="text" value={editForm.isbn}
                  onChange={e => setEditForm({...editForm, isbn: e.target.value})} />
              </div>
              <div>
                <label style={styles.label}>Total Copies</label>
                <input style={styles.modalInput} type="number" min="1" value={editForm.total_copies}
                  onChange={e => setEditForm({...editForm, total_copies: e.target.value})} />
              </div>
              <div>
                <label style={styles.label}>Location</label>
                <select style={styles.modalInput} value={editForm.location_code}
                  onChange={e => setEditForm({...editForm, location_code: e.target.value})}>
                  {SHELF_OPTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </div>
              <div>
                <label style={styles.label}>Description</label>
                <input style={styles.modalInput} type="text" value={editForm.description}
                  onChange={e => setEditForm({...editForm, description: e.target.value})} />
              </div>
            </div>
            <div style={{display:"flex", gap:"0.5rem", justifyContent:"flex-end"}}>
              <button style={{...styles.btn, background:"#888"}} onClick={() => setEditingBook(null)}>Cancel</button>
              <button style={styles.btn} onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHECKOUTS TAB ────────────────────────────────────────────── */}
      {tab === "checkouts" && (
        <>
          <h3>Currently Checked Out</h3>
          <table style={styles.table}>
            <thead>
              <tr style={styles.header}>
                <th>Book</th><th>User</th><th>Location</th><th>Checked Out</th>
              </tr>
            </thead>
            <tbody>
              {checkouts.length === 0 && (
                <tr><td colSpan={4} style={{textAlign:"center",padding:"1rem",color:"#888"}}>
                  Nothing checked out.
                </td></tr>
              )}
              {checkouts.map(c => (
                <tr key={c.id} style={styles.row}>
                  <td>{c.book_title}</td>
                  <td>{c.user_email}</td>
                  <td><span style={styles.badge}>{c.book_location || "—"}</span></td>
                  <td>{fmt(c.checked_out_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── LOGS TAB ─────────────────────────────────────────────────── */}
      {tab === "logs" && (
        <>
          <div style={styles.consoleWrap}>
            {/* Terminal title bar */}
            <div style={styles.consoleTitleBar}>
              <div style={styles.consoleDots}>
                <span style={{...styles.dot, background:"#ff5f57"}} />
                <span style={{...styles.dot, background:"#febc2e"}} />
                <span style={{...styles.dot, background:"#28c840"}} />
              </div>
              <span style={styles.consoleTitleText}>audit-log — library system</span>
              <span style={styles.consoleCount}>{logs.length} events</span>
            </div>

            {/* Scrollable log body */}
            <div style={styles.consoleBody}>
              {logs.length === 0 && (
                <div style={styles.consoleEmpty}>~ no log entries found</div>
              )}
              {logs.map((l, i) => {
                const ts  = new Date(l.timestamp);
                const date = ts.toLocaleDateString("en-US", { month:"short", day:"2-digit", year:"numeric" });
                const time = ts.toLocaleTimeString("en-US", { hour12:false });
                const color = ACTION_COLORS[l.action] || "#94a3b8";
                const parts = [];
                if (l.book_title)        parts.push(`book="${l.book_title}"`);
                if (l.target_user_email) parts.push(`target="${l.target_user_email}"`);
                return (
                  <div key={l.id} style={{...styles.consoleLine, background: i%2===0 ? "transparent" : "rgba(255,255,255,0.018)"}}>
                    <span style={styles.consoleTs}>{date} {time}</span>
                    <span style={{...styles.consoleAction, color}}>[{l.action}]</span>
                    <span style={styles.consoleUser}>{l.performed_by_email}</span>
                    {parts.length > 0 && (
                      <span style={styles.consoleMeta}>{parts.join("  ")}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const ACTION_COLORS = {
  CHECKOUT:    "#4ade80",
  RETURN:      "#facc15",
  ADD_BOOK:    "#38bdf8",
  DELETE_BOOK: "#f87171",
  UPDATE_BOOK: "#a78bfa",
  REGISTER:    "#34d399",
  LOGIN:       "#94a3b8",
};

const styles = {
  form:      { display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"1.5rem", alignItems:"center" },
  input:     { padding:"0.5rem 0.75rem", border:"1px solid #ccc", borderRadius:"4px",
               fontSize:"0.95rem", flex:1, minWidth:"160px" },
  btn:       { padding:"0.5rem 1rem", background:"#003087", color:"#fff",
               border:"none", borderRadius:"4px", cursor:"pointer" },
  btnSecondary: { padding:"0.35rem 0.75rem", background:"#1f2937", color:"#fff",
               border:"none", borderRadius:"4px", cursor:"pointer", fontSize:"0.85rem" },
  btnDanger: { padding:"0.35rem 0.75rem", background:"#c00", color:"#fff",
               border:"none", borderRadius:"4px", cursor:"pointer", fontSize:"0.85rem" },
  rowActions: { display:"flex", gap:"0.45rem", justifyContent:"flex-end" },
  label: { display:"block", marginBottom:"0.25rem", fontWeight:"600", fontSize:"0.9rem", color:"#333" },
  modalOverlay: { position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 },
  modalContent: { background:"#fff", borderRadius:"10px", padding:"2rem", maxWidth:"600px", width:"90vw", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" },
  modalInput: { width:"100%", padding:"0.55rem 0.75rem", border:"1px solid #ccc", borderRadius:"4px", fontSize:"0.95rem", boxSizing:"border-box" },
  table:     { width:"100%", borderCollapse:"collapse" },
  header:    { background:"#f0f4f8", textAlign:"left" },
  row:       { borderBottom:"1px solid #eee" },
  badge:     { background:"#e8f0fe", color:"#003087", padding:"2px 8px",
               borderRadius:"12px", fontSize:"0.8rem" },
  success:   { background:"#eaffea", color:"#080", padding:"0.6rem",
               borderRadius:"4px", marginBottom:"0.5rem" },
  error:     { background:"#ffeaea", color:"#c00", padding:"0.6rem",
               borderRadius:"4px", marginBottom:"0.5rem" },
  dropdown:  { position:"absolute", top:"100%", left:0, right:0, background:"#fff",
               border:"1px solid #ccc", borderRadius:"4px", boxShadow:"0 4px 12px rgba(0,0,0,0.12)",
               zIndex:100, listStyle:"none", margin:"2px 0 0", padding:0, maxHeight:"220px", overflowY:"auto" },
  dropItem:  { padding:"0.6rem 0.75rem", color:"#888", fontSize:"0.9rem" },
  dropItemHover: { padding:"0.6rem 0.75rem", cursor:"pointer", fontSize:"0.9rem",
                   borderBottom:"1px solid #f0f0f0" },
  chipContainer: { display:"flex", flexWrap:"wrap", gap:"0.4rem", marginBottom:"0.75rem",
                   padding:"0.5rem", background:"#f8f9ff", borderRadius:"6px",
                   border:"1px solid #d0d8f0" },
  /* console */
  consoleWrap:      { borderRadius:10, overflow:"hidden",
                      boxShadow:"0 8px 32px rgba(0,0,0,0.45)", marginTop:"0.5rem" },
  consoleTitleBar:  { display:"flex", alignItems:"center", gap:"0.75rem",
                      background:"#2d2d2d", padding:"0.55rem 1rem", userSelect:"none" },
  consoleDots:      { display:"flex", gap:6 },
  dot:              { width:12, height:12, borderRadius:"50%", display:"inline-block" },
  consoleTitleText: { flex:1, textAlign:"center", fontSize:"0.78rem", color:"#888",
                      fontFamily:"monospace", letterSpacing:"0.05em" },
  consoleCount:     { fontSize:"0.72rem", color:"#555", fontFamily:"monospace" },
  consoleBody:      { background:"#0d1117", height:520, overflowY:"auto",
                      padding:"0.75rem 0", fontFamily:"'Cascadia Code','Fira Code','JetBrains Mono',monospace",
                      fontSize:"0.78rem", lineHeight:1.7 },
  consoleLine:      { display:"flex", gap:"1rem", alignItems:"baseline",
                      padding:"0.1rem 1rem", flexWrap:"wrap" },
  consoleTs:        { color:"#4b5563", flexShrink:0, minWidth:160 },
  consoleAction:    { fontWeight:700, flexShrink:0, minWidth:140, letterSpacing:"0.03em" },
  consoleUser:      { color:"#c9d1d9", flexShrink:0 },
  consoleMeta:      { color:"#6e7681", wordBreak:"break-all" },
  consoleEmpty:     { padding:"1.5rem 1rem", color:"#4b5563", fontFamily:"monospace" },
  chip:          { display:"inline-flex", alignItems:"center", gap:"0.35rem",
                   background:"#e8efff", border:"1px solid #b0c0e8",
                   borderRadius:"20px", padding:"0.25rem 0.5rem 0.25rem 0.75rem",
                   fontSize:"0.88rem", color:"#003087" },
  chipRemove:    { background:"none", border:"none", cursor:"pointer", color:"#c00",
                   fontWeight:"bold", fontSize:"1rem", lineHeight:1,
                   padding:"0 0.2rem", marginLeft:"0.1rem" },
};
