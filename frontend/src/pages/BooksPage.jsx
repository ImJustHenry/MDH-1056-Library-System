import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useCart } from "../context/CartContext";

export default function BooksPage() {
  const { cart, addToCart, updateQuantity, totalItems } = useCart();
  const navigate                              = useNavigate();
  const [books,     setBooks]     = useState([]);
  const [search,    setSearch]    = useState("");
  const [available, setAvailable] = useState("");
  const [error,     setError]     = useState("");

  const fetchBooks = async () => {
    const params = {};
    if (search)    params.q         = search;
    if (available) params.available  = available;
    try {
      const { data } = await api.get("/books", { params });
      setBooks(data);
    } catch {
      setError("Failed to load books.");
    }
  };

  useEffect(() => { fetchBooks(); }, []);

  const handleSearch = (e) => { e.preventDefault(); fetchBooks(); };

  const cartQty = (bookId) => cart.find(i => i.id === bookId)?.quantity || 0;

  const promptCheckoutLocation = (book) => {
    const counts = book.location_counts || {};
    const entries = Object.entries(counts)
      .filter(([, count]) => Number(count) > 0)
      .sort(([left], [right]) => left.localeCompare(right));

    if (entries.length <= 1) {
      return entries[0]?.[0] || book.location_code || "A1";
    }

    const choices = entries.map(([code, count]) => `${code}:${count}`).join(", ");
    const picked = window.prompt(
      `"${book.title}" has multiple shelf locations.\nChoose where this cart copy will be checked out from.\nAvailable: ${choices}\n\nEnter location code (e.g., A1):`,
      entries[0][0]
    );

    if (picked === null) return "";
    const normalized = String(picked).trim().toUpperCase();
    if (!entries.some(([code]) => code === normalized)) {
      setError(`Invalid location for "${book.title}". Choose one of: ${choices}`);
      return "";
    }

    return normalized;
  };

  const handleAddBookToCart = (book) => {
    setError("");
    const locationCode = promptCheckoutLocation(book);
    if (!locationCode) return;
    addToCart(book, locationCode);
  };

  const locationSummary = (book) => {
    const counts = book.location_counts || {};
    const entries = Object.entries(counts).filter(([, count]) => Number(count) > 0);
    if (entries.length === 0) return book.location_code || "—";
    return entries
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => `${code}:${count}`)
      .join(", ");
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
        <h2 style={{ margin:0 }}>Book Catalog</h2>
        <button style={styles.cartBtn} onClick={() => navigate("/cart")}>
          🛒 Cart{totalItems > 0 && <span style={styles.badge}>{totalItems}</span>}
        </button>
      </div>

      {/* Search + Filter */}
      <form onSubmit={handleSearch} style={styles.searchRow}>
        <input style={styles.searchInput} placeholder="Search title, author, ISBN…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select style={styles.select} value={available}
          onChange={e => setAvailable(e.target.value)}>
          <option value="">All Books</option>
          <option value="true">Available Only</option>
          <option value="false">Checked Out</option>
        </select>
        <button style={styles.btn} type="submit">Search</button>
        <button style={styles.btnOutline} type="button" onClick={() => {
          setSearch(""); setAvailable(""); setTimeout(fetchBooks, 0);
        }}>Clear</button>
      </form>

      {error && <p style={styles.error}>{error}</p>}

      {/* Books Table */}
      <table style={styles.table}>
        <thead>
          <tr style={styles.header}>
            <th>Title</th><th>Author</th><th>ISBN</th>
            <th>Location</th><th>Copies</th><th></th>
          </tr>
        </thead>
        <tbody>
          {books.length === 0 && (
            <tr><td colSpan={6} style={{textAlign:"center",padding:"1rem",color:"#888"}}>
              No books found.
            </td></tr>
          )}
          {books.map(book => {
            const inCart = cartQty(book.id);
            const maxed  = inCart >= book.available_copies;
            return (
              <tr key={book.id} style={styles.row}>
                <td>{book.title}</td>
                <td>{book.author}</td>
                <td style={{color:"#888",fontSize:"0.85rem"}}>{book.isbn || "—"}</td>
                <td>
                  <span style={styles.locationTag}>{locationSummary(book)}</span>
                </td>
                <td>
                  <span style={book.available_copies > 0 ? styles.avail : styles.unavail}>
                    {book.available_copies}/{book.total_copies}
                  </span>
                </td>
                <td>
                  {book.available_copies < 1 ? (
                    <span style={styles.outTag}>Out of Stock</span>
                  ) : inCart > 0 ? (
                    <div style={styles.inCartRow}>
                      <button style={styles.qtyBtn}
                        onClick={() => updateQuantity(book.id, inCart - 1)}>−</button>
                      <span style={styles.qtyNum}>{inCart}</span>
                      <button style={{...styles.qtyBtn, opacity: maxed ? 0.4 : 1}}
                        disabled={maxed}
                        onClick={() => handleAddBookToCart(book)}>+</button>
                      <span style={styles.inCartTag}>in cart</span>
                    </div>
                  ) : (
                    <button style={styles.addBtn} onClick={() => handleAddBookToCart(book)}>
                      + Add to Cart
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  searchRow:   { display:"flex", gap:"0.5rem", marginBottom:"1rem", flexWrap:"wrap" },
  searchInput: { flex:1, minWidth:"200px", padding:"0.5rem 0.75rem",
                 border:"1px solid #ccc", borderRadius:"4px", fontSize:"0.95rem" },
  select:      { padding:"0.5rem 0.75rem", border:"1px solid #ccc",
                 borderRadius:"4px", fontSize:"0.95rem" },
  btn:         { padding:"0.5rem 1rem", background:"#003087", color:"#fff",
                 border:"none", borderRadius:"4px", cursor:"pointer" },
  btnOutline:  { padding:"0.5rem 1rem", background:"#fff", color:"#003087",
                 border:"1px solid #003087", borderRadius:"4px", cursor:"pointer" },
  addBtn:      { padding:"0.4rem 0.85rem", background:"#003087", color:"#fff",
                 border:"none", borderRadius:"4px", cursor:"pointer", fontSize:"0.88rem" },
  outTag:      { fontSize:"0.82rem", color:"#888", fontStyle:"italic" },
  inCartRow:   { display:"flex", alignItems:"center", gap:"0.4rem" },
  qtyBtn:      { width:26, height:26, border:"1px solid #ccc", borderRadius:4,
                 background:"#f5f5f5", cursor:"pointer", fontWeight:"bold", fontSize:"0.95rem" },
  qtyNum:      { minWidth:20, textAlign:"center", fontWeight:"600" },
  inCartTag:   { fontSize:"0.78rem", color:"#003087", fontWeight:"600" },
  cartBtn:     { display:"flex", alignItems:"center", gap:"0.4rem", padding:"0.45rem 1rem",
                 background:"#003087", color:"#fff", border:"none", borderRadius:4,
                 cursor:"pointer", fontWeight:"600", fontSize:"0.95rem", position:"relative" },
  badge:       { background:"#e53", color:"#fff", borderRadius:"50%", width:20, height:20,
                 display:"inline-flex", alignItems:"center", justifyContent:"center",
                 fontSize:"0.75rem", fontWeight:"bold", marginLeft:2 },
  table:   { width:"100%", borderCollapse:"collapse" },
  header:  { background:"#f0f4f8", textAlign:"left" },
  row:     { borderBottom:"1px solid #eee" },
  avail:   { background:"#eaffea", color:"#080", padding:"2px 8px",
             borderRadius:"12px", fontSize:"0.85rem" },
  unavail: { background:"#ffeaea", color:"#c00", padding:"2px 8px",
             borderRadius:"12px", fontSize:"0.85rem" },
  locationTag: { background:"#e8f0fe", color:"#003087", padding:"2px 8px",
                 borderRadius:"12px", fontSize:"0.85rem", fontWeight:"600" },
  error:   { background:"#ffeaea", color:"#c00", padding:"0.6rem",
             borderRadius:"4px", marginBottom:"0.5rem" },
};
