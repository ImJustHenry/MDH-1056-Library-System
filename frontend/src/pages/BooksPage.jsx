import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useCart } from "../context/CartContext";
import useViewportMatch from "../hooks/useViewportMatch";

export default function BooksPage() {
  const { cart, addToCart, updateQuantity, totalItems } = useCart();
  const navigate                              = useNavigate();
  const isPhone = useViewportMatch(820);
  const [books,     setBooks]     = useState([]);
  const [search,    setSearch]    = useState("");
  const [available, setAvailable] = useState("");
  const [isbnStatus, setIsbnStatus] = useState("");
  const [error,     setError]     = useState("");
  const [locationPicker, setLocationPicker] = useState({
    open: false,
    book: null,
    options: [],
    selected: "",
  });

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

  const getLocationOptions = (book) => {
    const counts = book.location_counts || {};
    const cartItem = cart.find((item) => item.id === book.id);
    const selectedCounts = cartItem?.selected_location_counts || {};

    return Object.entries(counts)
      .map(([code, count]) => [code, Number(count) - Number(selectedCounts[code] || 0)])
      .filter(([, remaining]) => remaining > 0)
      .sort(([left], [right]) => left.localeCompare(right));
  };

  const handleAddBookToCart = (book) => {
    setError("");
    const entries = getLocationOptions(book);
    if (entries.length === 0) {
      setError(`No remaining copies by shelf location for "${book.title}".`);
      return;
    }
    if (entries.length <= 1) {
      const fallback = entries[0]?.[0] || book.location_code || "A1";
      addToCart(book, fallback);
      return;
    }

    setLocationPicker({
      open: true,
      book,
      options: entries,
      selected: entries[0][0],
    });
  };

  const handleConfirmLocationPick = () => {
    if (!locationPicker.book || !locationPicker.selected) return;
    addToCart(locationPicker.book, locationPicker.selected);
    setLocationPicker({ open: false, book: null, options: [], selected: "" });
  };

  const handleCancelLocationPick = () => {
    setLocationPicker({ open: false, book: null, options: [], selected: "" });
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

  const filteredBooks = books.filter((book) => {
    if (isbnStatus === "unknown") {
      return !(book.isbn || "").trim();
    }
    if (isbnStatus === "known") {
      return !!(book.isbn || "").trim();
    }
    return true;
  });

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
        <h2 style={{ margin:0 }}>Book Catalog</h2>
        <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
          <button style={styles.scanBtn} onClick={() => navigate("/barcode")}>Scan Barcode</button>
          <button style={styles.cartBtn} onClick={() => navigate("/cart") }>
            🛒 Cart{totalItems > 0 && <span style={styles.badge}>{totalItems}</span>}
          </button>
        </div>
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
        <select style={styles.select} value={isbnStatus}
          onChange={e => setIsbnStatus(e.target.value)}>
          <option value="">All ISBN</option>
          <option value="known">Known ISBN</option>
          <option value="unknown">Unknown ISBN</option>
        </select>
        <button style={styles.btn} type="submit">Search</button>
        <button style={styles.btnOutline} type="button" onClick={() => {
          setSearch(""); setAvailable(""); setIsbnStatus(""); setTimeout(fetchBooks, 0);
        }}>Clear</button>
      </form>

      {error && <p style={styles.error}>{error}</p>}

      {/* Books Table / Cards */}
      {isPhone ? (
        <div style={styles.mobileList}>
          {filteredBooks.length === 0 && (
            <div style={styles.mobileEmpty}>No books found.</div>
          )}
          {filteredBooks.map((book) => {
            const inCart = cartQty(book.id);
            const maxed = inCart >= book.available_copies;
            return (
              <div key={book.id} style={styles.mobileCard}>
                <div style={styles.mobileTitle}>{book.title}</div>
                <div style={styles.mobileMeta}>{book.author}</div>
                <div style={styles.mobileMeta}>ISBN: {book.isbn || "—"}</div>
                <div style={styles.mobileRow}>
                  <span style={styles.mobileLabel}>Location</span>
                  <span style={styles.locationTag}>{locationSummary(book)}</span>
                </div>
                <div style={styles.mobileRow}>
                  <span style={styles.mobileLabel}>Copies</span>
                  <span style={book.available_copies > 0 ? styles.avail : styles.unavail}>
                    {book.available_copies}/{book.total_copies}
                  </span>
                </div>
                <div style={{ marginTop: "0.55rem" }}>
                  {book.available_copies < 1 ? (
                    <span style={styles.outTag}>Out of Stock</span>
                  ) : inCart > 0 ? (
                    <div style={styles.inCartRow}>
                      <button style={styles.qtyBtn} onClick={() => updateQuantity(book.id, inCart - 1)}>−</button>
                      <span style={styles.qtyNum}>{inCart}</span>
                      <button
                        style={{ ...styles.qtyBtn, opacity: maxed ? 0.4 : 1 }}
                        disabled={maxed}
                        onClick={() => handleAddBookToCart(book)}
                      >
                        +
                      </button>
                      <span style={styles.inCartTag}>in cart</span>
                    </div>
                  ) : (
                    <button style={styles.addBtn} onClick={() => handleAddBookToCart(book)}>
                      + Add to Cart
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.header}>
              <th>Title</th><th>Author</th><th>ISBN</th>
              <th>Location</th><th>Copies</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.length === 0 && (
              <tr><td colSpan={6} style={{textAlign:"center",padding:"1rem",color:"#888"}}>
                No books found.
              </td></tr>
            )}
            {filteredBooks.map(book => {
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
      )}

      {locationPicker.open && (
        <div style={styles.pickerOverlay} onClick={handleCancelLocationPick}>
          <div style={styles.pickerCard} onClick={(event) => event.stopPropagation()}>
            <h4 style={{ margin: "0 0 0.5rem" }}>Select Pickup Location</h4>
            <p style={{ margin: "0 0 0.7rem", color: "#555", fontSize: "0.9rem" }}>
              {locationPicker.book?.title}
            </p>
            <select
              style={styles.select}
              value={locationPicker.selected}
              onChange={(event) => setLocationPicker((prev) => ({ ...prev, selected: event.target.value }))}
            >
              {locationPicker.options.map(([code, count]) => (
                <option key={code} value={code}>{code} ({count} available)</option>
              ))}
            </select>
            <div style={styles.pickerActions}>
              <button style={styles.btnOutline} onClick={handleCancelLocationPick}>Cancel</button>
              <button style={styles.btn} onClick={handleConfirmLocationPick}>Add to Cart</button>
            </div>
          </div>
        </div>
      )}
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
  mobileList:  { display:"grid", gap:"0.7rem" },
  mobileCard:  { border:"1px solid #e5e7eb", borderRadius:10, background:"#fff", padding:"0.75rem" },
  mobileTitle: { fontSize:"0.96rem", fontWeight:"700", color:"#0f172a", marginBottom:"0.2rem" },
  mobileMeta:  { fontSize:"0.82rem", color:"#64748b", marginBottom:"0.18rem", wordBreak:"break-word" },
  mobileRow:   { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"0.5rem", marginTop:"0.35rem" },
  mobileLabel: { fontSize:"0.8rem", color:"#475569", fontWeight:"600" },
  mobileEmpty: { textAlign:"center", color:"#888", padding:"1rem", border:"1px dashed #d1d5db", borderRadius:8 },
  cartBtn:     { display:"flex", alignItems:"center", gap:"0.4rem", padding:"0.45rem 1rem",
                 background:"#003087", color:"#fff", border:"none", borderRadius:4,
                 cursor:"pointer", fontWeight:"600", fontSize:"0.95rem", position:"relative" },
  scanBtn:     { padding:"0.45rem 0.9rem", background:"#fff", color:"#003087", border:"1px solid #003087",
                 borderRadius:4, cursor:"pointer", fontWeight:"600", fontSize:"0.92rem" },
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
  pickerOverlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1200 },
  pickerCard: { width:"92vw", maxWidth:360, background:"#fff", borderRadius:10, padding:"1rem", boxShadow:"0 20px 50px rgba(0,0,0,0.25)" },
  pickerActions: { marginTop:"0.8rem", display:"flex", justifyContent:"flex-end", gap:"0.5rem" },
  error:   { background:"#ffeaea", color:"#c00", padding:"0.6rem",
             borderRadius:"4px", marginBottom:"0.5rem" },
};
