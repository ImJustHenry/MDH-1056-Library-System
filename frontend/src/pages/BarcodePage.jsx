import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { SHELF_OPTIONS } from "../constants/shelfLocations";
import { useCart } from "../context/CartContext";
import useViewportMatch from "../hooks/useViewportMatch";

export default function BarcodePage() {
  const isPhone = useViewportMatch(820);
  const { addToCart } = useCart();

  const [books, setBooks] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [locationModal, setLocationModal] = useState({ open: false, book: null, options: [], defaultLocation: "A1" });
  const [selectedLocation, setSelectedLocation] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);
  const scanLockRef = useRef(false);

  useEffect(() => { fetchBooks(); }, []);

  const fetchBooks = async () => {
    try { const { data } = await api.get("/books"); setBooks(data); }
    catch { setError("Failed to load books."); }
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
    const local = books.find((b) => variants.includes(normalizeIsbn(b.isbn)));
    if (local) return local;
    try {
      const { data } = await api.get("/books");
      return data.find((b) => variants.includes(normalizeIsbn(b.isbn))) || null;
    } catch { return null; }
  };

  const stopScanner = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    scanLockRef.current = false;
  };

  const handleBarcodeDetected = async (rawValue) => {
    const barcode = normalizeIsbn(rawValue);
    if (!barcode) return;
    setError(""); setMsg("");
    stopScanner(); setShowScanner(false);

    const existing = await findExistingBookByIsbn(barcode);
    if (!existing) {
      window.alert("Invalid barcode — please search for the book.");
      return;
    }

    const counts = existing.location_counts || {};
    const entries = Object.entries(counts).filter(([, c]) => Number(c) > 0);
    const options = entries.length ? entries.map(([code]) => code) : [existing.location_code || "A1"];
    const defaultLocation = entries[0]?.[0] || existing.location_code || "A1";

    setLocationModal({ open: true, book: existing, options, defaultLocation });
    setSelectedLocation(defaultLocation);
  };

  const confirmLocationAndAdd = () => {
    const book = locationModal.book;
    if (!book) { setLocationModal({ open: false, book: null, options: [], defaultLocation: "A1" }); return; }
    const code = String(selectedLocation || locationModal.defaultLocation || "A1").trim().toUpperCase();
    if (locationModal.options.length && !locationModal.options.includes(code)) {
      setError("Invalid location selected.");
      return;
    }
    addToCart(book, code);
    setMsg(`Added "${book.title}" → ${code} to cart.`);
    setLocationModal({ open: false, book: null, options: [], defaultLocation: "A1" });
  };

  const cancelLocationModal = () => {
    setLocationModal({ open: false, book: null, options: [], defaultLocation: "A1" });
    setMsg("Scan skipped.");
  };

  const startScanner = async () => {
    setScannerError("");
    if (!("mediaDevices" in navigator) || !("getUserMedia" in navigator.mediaDevices)) {
      setScannerError("Camera not available on this device/browser."); return;
    }
    try {
      if ("BarcodeDetector" in window) {
        const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];
        detectorRef.current = new window.BarcodeDetector({ formats });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:{ ideal: "environment" }, width:{ ideal:1280 }, height:{ ideal:720 } }, audio:false });
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }

        const tick = async () => {
          if (!showScanner || !videoRef.current || !detectorRef.current) return;
          try {
            if (!scanLockRef.current) {
              const detected = await detectorRef.current.detect(videoRef.current);
              if (detected?.length) {
                const raw = detected[0]?.rawValue || "";
                const cleaned = normalizeIsbn(raw);
                if (cleaned.length >= 8) { scanLockRef.current = true; await handleBarcodeDetected(cleaned); return; }
              }
            }
          } catch {}
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!videoRef.current) { setScannerError("Scanner preview failed to initialize."); return; }
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints({ video: { facingMode:{ ideal: "environment" }, width:{ ideal:1280 }, height:{ ideal:720 } } }, videoRef.current, async (result) => {
        if (scanLockRef.current) return;
        const raw = result?.getText?.() || "";
        const cleaned = normalizeIsbn(raw);
        if (cleaned.length >= 8) { scanLockRef.current = true; await handleBarcodeDetected(cleaned); }
      });

    } catch (err) { setScannerError(err?.message || "Unable to start camera scanner."); stopScanner(); }
  };

  useEffect(() => { if (showScanner) startScanner(); else stopScanner(); return () => stopScanner(); }, [showScanner]);

  return (
    <div>
      <h2>Barcode Scanner</h2>
      <p>Scan a book barcode to add it to the cart for checkout.</p>

      {error && <div style={{ color:"crimson" }}>{error}</div>}
      {msg && <div style={{ color:"green" }}>{msg}</div>}

      <div style={{ marginTop:12 }}>
        <button onClick={() => setShowScanner(s => !s)}>{showScanner ? "Stop scanner" : "Start scanner"}</button>
        <button onClick={() => { const manual = window.prompt("Enter ISBN or barcode:", ""); if (manual) handleBarcodeDetected(manual); }} style={{ marginLeft:8 }}>Manual ISBN</button>
      </div>

      <div style={{ marginTop:12 }}>
        {scannerError && <div style={{ color:"crimson" }}>{scannerError}</div>}
        <video ref={videoRef} style={{ width: isPhone ? "100%" : 560, maxWidth:"100%", marginTop:12 }} playsInline muted />
      </div>

      {locationModal.open && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:400 }}>
          <div style={{ background:"#fff", padding:16, borderRadius:8, width:340, maxWidth:"90%" }}>
            <h3 style={{ margin:0 }}>{locationModal.book?.title || "Select location"}</h3>
            <p style={{ marginTop:8, marginBottom:8 }}>Choose pickup shelf/location:</p>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} style={{ width:"100%", padding:8 }}>
              {locationModal.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:12 }}>
              <button onClick={cancelLocationModal}>Cancel</button>
              <button onClick={confirmLocationAndAdd}>Add to cart</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
