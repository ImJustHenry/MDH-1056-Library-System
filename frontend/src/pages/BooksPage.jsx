import { useEffect, useRef, useState } from "react";
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
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannerMessage, setScannerMessage] = useState("");
  const [scannerLocationModal, setScannerLocationModal] = useState({
    open: false,
    book: null,
    options: [],
    defaultLocation: "A1",
  });
  const [scannerSelectedLocation, setScannerSelectedLocation] = useState("");

  const scannerVideoRef = useRef(null);
  const scannerStreamRef = useRef(null);
  const scannerRafRef = useRef(null);
  const scannerDetectorRef = useRef(null);
  const scannerLockRef = useRef(false);

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

  const normalizeIsbn = (value) => (value || "").replace(/[^0-9Xx]/g, "").toUpperCase();

  const isValidEan13 = (code) => {
    if (!/^\d{13}$/.test(code)) return false;
    const digits = code.split("").map(Number);
    const checksum = digits
      .slice(0, 12)
      .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0);
    const checkDigit = (10 - (checksum % 10)) % 10;
    return checkDigit === digits[12];
  };

  const isValidIsbn10 = (code) => {
    if (!/^\d{9}[\dX]$/.test(code)) return false;
    const digits = code.split("");
    const checksum = digits
      .slice(0, 9)
      .reduce((sum, char, index) => sum + Number(char) * (10 - index), 0);
    const last = digits[9] === "X" ? 10 : Number(digits[9]);
    return (checksum + last) % 11 === 0;
  };

  const isbn10To13 = (isbn10) => {
    const base = `978${isbn10.slice(0, 9)}`;
    const checksum = base
      .split("")
      .map(Number)
      .reduce((sum, digit, index) => sum + digit * (index % 2 === 0 ? 1 : 3), 0);
    const checkDigit = (10 - (checksum % 10)) % 10;
    return `${base}${checkDigit}`;
  };

  const isbn13To10 = (isbn13) => {
    if (!/^978\d{10}$/.test(isbn13) || !isValidEan13(isbn13)) return "";
    const body = isbn13.slice(3, 12);
    const sum = body
      .split("")
      .map(Number)
      .reduce((acc, digit, index) => acc + digit * (10 - index), 0);
    const checkValue = (11 - (sum % 11)) % 11;
    const checkDigit = checkValue === 10 ? "X" : String(checkValue);
    return `${body}${checkDigit}`;
  };

  const getIsbnVariants = (rawCode) => {
    const code = normalizeIsbn(rawCode);
    if (!code) return [];
    const variants = new Set([code]);
    if (code.length === 10 && isValidIsbn10(code)) variants.add(isbn10To13(code));
    if (code.length === 13 && /^97[89]/.test(code) && isValidEan13(code)) {
      if (code.startsWith("978")) {
        const isbn10 = isbn13To10(code);
        if (isbn10) variants.add(isbn10);
      }
    }
    return Array.from(variants);
  };

  const findExistingBookByIsbn = async (isbn) => {
    const variants = getIsbnVariants(isbn);
    if (!variants.length) return null;
    const localMatch = books.find((book) => variants.includes(normalizeIsbn(book.isbn)));
    if (localMatch) return localMatch;
    try {
      const { data } = await api.get("/books");
      return data.find((book) => variants.includes(normalizeIsbn(book.isbn))) || null;
    } catch {
      return null;
    }
  };

  const stopScanner = () => {
    if (scannerRafRef.current) {
      cancelAnimationFrame(scannerRafRef.current);
      scannerRafRef.current = null;
    }
    if (scannerStreamRef.current) {
      scannerStreamRef.current.getTracks().forEach((track) => track.stop());
      scannerStreamRef.current = null;
    }
    if (scannerVideoRef.current) {
      scannerVideoRef.current.srcObject = null;
    }
    scannerLockRef.current = false;
  };

  const closeScannerLocationModal = () => {
    setScannerLocationModal({ open: false, book: null, options: [], defaultLocation: "A1" });
    setScannerSelectedLocation("");
    setScannerMessage("Scan skipped.");
  };

  const confirmScannerLocation = () => {
    const book = scannerLocationModal.book;
    if (!book) return;
    const code = String(scannerSelectedLocation || scannerLocationModal.defaultLocation || "A1").trim().toUpperCase();
    if (scannerLocationModal.options.length && !scannerLocationModal.options.includes(code)) {
      setScannerError("Invalid location selected.");
      return;
    }
    addToCart(book, code);
    setScannerMessage(`Added "${book.title}" → ${code} to cart.`);
    setScannerLocationModal({ open: false, book: null, options: [], defaultLocation: "A1" });
    setScannerSelectedLocation("");
  };

  const handleScannerDetected = async (rawValue) => {
    const barcode = normalizeIsbn(rawValue);
    if (!barcode) return;
    setError("");
    setMsg("");
    setScannerError("");
    setScannerMessage("");
    stopScanner();
    setShowScanner(false);

    const existing = await findExistingBookByIsbn(barcode);
    if (!existing) {
      setScannerError("Invalid barcode, please search for the book.");
      return;
    }

    const counts = existing.location_counts || {};
    const options = Object.entries(counts)
      .filter(([, count]) => Number(count) > 0)
      .map(([code]) => code);
    const defaultLocation = options[0] || existing.location_code || "A1";

    setScannerLocationModal({
      open: true,
      book: existing,
      options: options.length ? options : [defaultLocation],
      defaultLocation,
    });
    setScannerSelectedLocation(defaultLocation);
  };

  const startScanner = async () => {
    setScannerError("");
    setScannerMessage("");

    if (!("mediaDevices" in navigator) || !("getUserMedia" in navigator.mediaDevices)) {
      setScannerError("Camera is not available on this device/browser.");
      return;
    }

    try {
      if ("BarcodeDetector" in window) {
        const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];
        scannerDetectorRef.current = new window.BarcodeDetector({ formats });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        scannerStreamRef.current = stream;
        if (scannerVideoRef.current) {
          scannerVideoRef.current.srcObject = stream;
          await scannerVideoRef.current.play();
        }

        const tick = async () => {
          if (!showScanner || !scannerVideoRef.current || !scannerDetectorRef.current) return;

          try {
            if (!scannerLockRef.current) {
              const detected = await scannerDetectorRef.current.detect(scannerVideoRef.current);
              if (detected?.length) {
                const cleaned = normalizeIsbn(detected[0]?.rawValue || "");
                if (cleaned.length >= 8) {
                  scannerLockRef.current = true;
                  await handleScannerDetected(cleaned);
                  return;
                }
              }
            }
          } catch {
            // Ignore per-frame detection errors.
          }

          scannerRafRef.current = requestAnimationFrame(tick);
        };

        scannerRafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!scannerVideoRef.current) {
        setScannerError("Scanner preview failed to initialize.");
        return;
      }

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        scannerVideoRef.current,
        async (result) => {
          if (scannerLockRef.current) return;
          const cleaned = normalizeIsbn(result?.getText?.() || "");
          if (cleaned.length >= 8) {
            scannerLockRef.current = true;
            await handleScannerDetected(cleaned);
          }
        }
      );

      if (controls?.stop) {
        scannerDetectorRef.current = null;
      }
    } catch (err) {
      setScannerError(err?.message || "Unable to start camera scanner.");
      stopScanner();
    }
  };

  useEffect(() => {
    if (showScanner) startScanner();
    else stopScanner();
    return () => stopScanner();
  }, [showScanner]);

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
          <button style={styles.scanBtn} onClick={() => setShowScanner((prev) => !prev)}>
            {showScanner ? "Hide Scanner" : "Scan Barcode"}
          </button>
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
      {scannerMessage && <p style={styles.success}>{scannerMessage}</p>}
      {scannerError && <p style={styles.error}>{scannerError}</p>}

      {showScanner && (
        <div style={styles.scannerPanel}>
          <div style={styles.scannerHeader}>
            <div>
              <h3 style={{ margin: 0 }}>Barcode Scanner</h3>
              <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.92rem" }}>
                Scan a book barcode to add it to your cart.
              </p>
            </div>
            <button style={styles.btnOutline} type="button" onClick={() => setShowScanner(false)}>
              Close
            </button>
          </div>
          <video ref={scannerVideoRef} style={styles.scannerVideo} playsInline muted />
        </div>
      )}

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

      {scannerLocationModal.open && (
        <div style={styles.pickerOverlay} onClick={closeScannerLocationModal}>
          <div style={styles.pickerCard} onClick={(event) => event.stopPropagation()}>
            <h4 style={{ margin: "0 0 0.5rem" }}>Select Pickup Location</h4>
            <p style={{ margin: "0 0 0.7rem", color: "#555", fontSize: "0.9rem" }}>
              {scannerLocationModal.book?.title}
            </p>
            <select
              style={styles.select}
              value={scannerSelectedLocation}
              onChange={(event) => setScannerSelectedLocation(event.target.value)}
            >
              {scannerLocationModal.options.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            <div style={styles.pickerActions}>
              <button style={styles.btnOutline} type="button" onClick={closeScannerLocationModal}>Cancel</button>
              <button style={styles.btn} type="button" onClick={confirmScannerLocation}>Add to Cart</button>
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
  scannerPanel: { border:"1px solid #dbe4f0", borderRadius:10, background:"#fff", padding:"0.9rem", marginBottom:"1rem", boxShadow:"0 8px 20px rgba(15,23,42,0.06)" },
  scannerHeader: { display:"flex", justifyContent:"space-between", gap:"1rem", alignItems:"flex-start", marginBottom:"0.75rem" },
  scannerVideo: { width:"100%", maxWidth:680, aspectRatio:"16 / 9", background:"#0f172a", borderRadius:10, objectFit:"cover" },
  badge:       { background:"#e53", color:"#fff", borderRadius:"50%", width:20, height:20,
                 display:"inline-flex", alignItems:"center", justifyContent:"center",
                 fontSize:"0.75rem", fontWeight:"bold", marginLeft:2 },
    success:     { background:"#eaffea", color:"#080", padding:"0.6rem",
                   borderRadius:"4px", marginBottom:"0.5rem" },
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
