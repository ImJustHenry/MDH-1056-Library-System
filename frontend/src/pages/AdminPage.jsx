import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { SHELF_OPTIONS } from "../constants/shelfLocations";
import useViewportMatch from "../hooks/useViewportMatch";

export default function AdminPage() {
  const googleBooksApiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY || "";

  const [tab,       setTab]       = useState("books");
  const [books,     setBooks]     = useState([]);
  const [logs,      setLogs]      = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [error,     setError]     = useState("");
  const [msg,       setMsg]       = useState("");

  // Add book form
  const [form, setForm] = useState({ title:"", author:"", isbn:"", total_copies:1, location_code:"A1" });
  const isPhone = useViewportMatch(820);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [scannedBarcodes, setScannedBarcodes] = useState([]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const detectorRef = useRef(null);
  const zxingReaderRef = useRef(null);
  const zxingControlsRef = useRef(null);
  const scanLockRef = useRef(false);
  const scannerStockResolveRef = useRef(null);

  // Edit book modal
  const [editingBook,  setEditingBook]  = useState(null);
  const [editForm,     setEditForm]     = useState({});
  const [editLocationMode, setEditLocationMode] = useState("single");
  const [editLocationRows, setEditLocationRows] = useState([]);

  // Admin checkout form
  const [selectedBooks, setSelectedBooks] = useState([]);   // [{id, title, author}]
  const [userEmail,     setUserEmail]     = useState("");
  const [bookSearch,    setBookSearch]    = useState("");
  const [bookDropdown,  setBookDropdown]  = useState(false);
  const [hoveredBookId, setHoveredBookId] = useState(null);
  const [scannerStockModal, setScannerStockModal] = useState({
    open: false,
    location_code: "A1",
    quantity: 1,
    title: "",
  });

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

    if (code.length === 10 && isValidIsbn10(code)) {
      variants.add(isbn10To13(code));
    }

    if (code.length === 13 && /^97[89]/.test(code) && isValidEan13(code)) {
      if (code.startsWith("978")) {
        const isbn10 = isbn13To10(code);
        if (isbn10) variants.add(isbn10);
      }
    }

    return Array.from(variants);
  };

  const toBookIsbn = (rawCode) => {
    const code = normalizeIsbn(rawCode);
    if (!code) return "";

    if (code.length === 10 && isValidIsbn10(code)) {
      return code;
    }

    if (code.length === 13 && /^97[89]/.test(code) && isValidEan13(code)) {
      if (code.startsWith("978")) {
        return isbn13To10(code) || code;
      }
      return code;
    }

    return "";
  };

  const getBookByIsbn = (isbn) => {
    const variants = getIsbnVariants(isbn);
    return books.find((book) => variants.includes(normalizeIsbn(book.isbn))) || null;
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
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (zxingControlsRef.current?.stop) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }
    if (zxingReaderRef.current?.reset) {
      zxingReaderRef.current.reset();
      zxingReaderRef.current = null;
    }
    scanLockRef.current = false;
  };

  const fetchGoogleBookByQuery = async (query, useIsbnOperator = true) => {
    const search = useIsbnOperator ? `isbn:${query}` : query;
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", search);
    if (googleBooksApiKey) {
      url.searchParams.set("key", googleBooksApiKey);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      let reason = "";
      try {
        const errorData = await response.json();
        reason = errorData?.error?.message || "";
      } catch {
        reason = "";
      }
      throw new Error(`Google Books lookup failed (${response.status})${reason ? `: ${reason}` : ""}.`);
    }
    const data = await response.json();
    const first = data?.items?.[0]?.volumeInfo;
    if (!first) return null;
    return {
      title: (first.title || "").trim(),
      author: (first.authors || []).join(", ").trim(),
    };
  };

  const requestScannerStockPlacement = ({
    title,
    defaultLocation,
    defaultQuantity = 1,
  }) => {
    return new Promise((resolve) => {
      scannerStockResolveRef.current = resolve;
      setScannerStockModal({
        open: true,
        title: title || "Scanned book",
        location_code: (defaultLocation || "A1").toUpperCase(),
        quantity: Math.max(1, Number(defaultQuantity) || 1),
      });
    });
  };

  const closeScannerStockModal = (result) => {
    const resolver = scannerStockResolveRef.current;
    scannerStockResolveRef.current = null;
    setScannerStockModal((prev) => ({ ...prev, open: false }));
    if (resolver) resolver(result);
  };

  const addCopyToExistingBook = async (book, locationOverride, quantity = 1) => {
    const targetLocation = (locationOverride || form.location_code || book.location_code || "A1").toUpperCase();
    const qty = Number.isInteger(Number(quantity)) ? Math.max(1, Number(quantity)) : 1;
    const nextCounts = { ...(book.location_counts || {}) };
    nextCounts[targetLocation] = Number(nextCounts[targetLocation] || 0) + qty;

    await api.put(`/books/${book.id}`, {
      total_copies: Number(book.total_copies || 0) + qty,
      location_code: targetLocation,
      location_counts: nextCounts,
    });

    setMsg(`Added ${qty} more ${qty === 1 ? "copy" : "copies"} for "${book.title}" at ${targetLocation}.`);
    await fetchBooks();
  };

  const addBookFromBarcode = async (barcode, canonicalIsbn, skipDuplicateConfirm = false) => {
    const isbnToStore = canonicalIsbn || barcode;

    const existing = await findExistingBookByIsbn(isbnToStore);
    if (existing) {
      if (!skipDuplicateConfirm) {
        const proceed = window.confirm("This ISBN has been scanned before. Do you want to add more stock copies?");
        if (!proceed) {
          setMsg("Duplicate ISBN skipped.");
          return false;
        }
      }

      const placement = await requestScannerStockPlacement({
        title: existing.title,
        defaultLocation: form.location_code || existing.location_code || "A1",
        defaultQuantity: 1,
      });
      if (placement === null) {
        setMsg("Duplicate ISBN skipped.");
        return false;
      }

      await addCopyToExistingBook(existing, placement.locationCode, placement.quantity);
      return true;
    }

    let details = null;
    try {
      if (canonicalIsbn) {
        details = await fetchGoogleBookByQuery(canonicalIsbn, true);
      }
      if (!details) {
        details = await fetchGoogleBookByQuery(barcode, true);
      }
      if (!details) {
        details = await fetchGoogleBookByQuery(barcode, false);
      }
    } catch (lookupErr) {
      details = null;
      setMsg(lookupErr?.message || "Google Books lookup failed. Falling back to manual entry.");
    }

    if (!details?.title || !details?.author) {
      const title = window.prompt("Could not fetch full book details from Google Books. Enter title:", `Scanned Book ${barcode}`);
      if (title === null) return;
      const author = window.prompt("Enter author:", "Unknown Author");
      if (author === null) return;
      details = {
        title: String(title).trim(),
        author: String(author).trim(),
      };
      if (!details.title || !details.author) {
        throw new Error("Title and author are required to add scanned book.");
      }
    }

    const placement = await requestScannerStockPlacement({
      title: details.title,
      defaultLocation: form.location_code || "A1",
      defaultQuantity: form.total_copies || 1,
    });
    if (placement === null) {
      setMsg("Scanned book skipped.");
      return false;
    }

    const payload = {
      title: details.title,
      author: details.author,
      isbn: isbnToStore,
      total_copies: placement.quantity,
      location_code: placement.locationCode,
      location_counts: {
        [placement.locationCode]: placement.quantity,
      },
    };

    await api.post("/books", payload);
    setForm((prev) => ({
      ...prev,
      title: details.title,
      author: details.author,
      isbn: isbnToStore,
      total_copies: placement.quantity,
      location_code: placement.locationCode,
    }));
    setMsg(`Added "${details.title}" by ${details.author} from barcode (${placement.quantity} ${placement.quantity === 1 ? "copy" : "copies"} at ${placement.locationCode}).`);
    await fetchBooks();
    return true;
  };

  const handleBarcodeDetected = async (rawValue) => {
    const barcode = normalizeIsbn(rawValue);
    if (!barcode) return;
    const canonicalIsbn = toBookIsbn(barcode);
    const isbnForMatching = canonicalIsbn || barcode;

    setError("");
    setMsg("");
    stopScanner();
    setShowScanner(false);

    const existing = await findExistingBookByIsbn(isbnForMatching);
    const alreadyScanned = scannedBarcodes.includes(isbnForMatching);

    if (existing || alreadyScanned) {
      const proceed = window.confirm("This ISBN has been scanned before. Do you want to add more stock copies?");
      if (!proceed) {
        setMsg("Duplicate ISBN skipped.");
        return;
      }

      if (existing) {
        try {
          const placement = await requestScannerStockPlacement({
            title: existing.title,
            defaultLocation: form.location_code || existing.location_code || "A1",
            defaultQuantity: 1,
          });
          if (placement === null) {
            setMsg("Duplicate ISBN skipped.");
            return;
          }

          await addCopyToExistingBook(existing, placement.locationCode, placement.quantity);
          if (!scannedBarcodes.includes(isbnForMatching)) {
            setScannedBarcodes((prev) => [...prev, isbnForMatching]);
          }
        } catch (err) {
          setError(err.response?.data?.error || "Failed to add another copy.");
        }
        return;
      }
    }

    try {
      const didAdd = await addBookFromBarcode(barcode, canonicalIsbn, alreadyScanned);
      if (didAdd) {
        setScannedBarcodes((prev) => (prev.includes(isbnForMatching) ? prev : [...prev, isbnForMatching]));
      }
    } catch (err) {
      if (err.response?.status === 409 && /isbn/i.test(err.response?.data?.error || "")) {
        const matched = await findExistingBookByIsbn(isbnForMatching);
        if (matched) {
          const proceed = window.confirm("This ISBN has been scanned before. Do you want to add more stock copies?");
          if (proceed) {
            try {
              const placement = await requestScannerStockPlacement({
                title: matched.title,
                defaultLocation: form.location_code || matched.location_code || "A1",
                defaultQuantity: 1,
              });
              if (placement === null) {
                setMsg("Duplicate ISBN skipped.");
                return;
              }

              await addCopyToExistingBook(matched, placement.locationCode, placement.quantity);
              setScannedBarcodes((prev) => (prev.includes(isbnForMatching) ? prev : [...prev, isbnForMatching]));
              return;
            } catch (copyErr) {
              setError(copyErr.response?.data?.error || "Failed to add another copy.");
              return;
            }
          }
        }
        setError("There is duplicate ISBN.");
      } else {
        setError(err.response?.data?.error || err.message || "Failed to add scanned book.");
      }
    }
  };

  const startScanner = async () => {
    setScannerError("");
    if (!("mediaDevices" in navigator) || !("getUserMedia" in navigator.mediaDevices)) {
      setScannerError("Camera is not available on this device/browser.");
      return;
    }

    try {
      if ("BarcodeDetector" in window) {
        const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];
        detectorRef.current = new window.BarcodeDetector({ formats });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const tick = async () => {
          if (!showScanner || !videoRef.current || !detectorRef.current) return;

          try {
            if (!scanLockRef.current) {
              const detected = await detectorRef.current.detect(videoRef.current);
              if (detected?.length) {
                const raw = detected[0]?.rawValue || "";
                const cleaned = normalizeIsbn(raw);
                if (cleaned.length >= 8) {
                  scanLockRef.current = true;
                  await handleBarcodeDetected(cleaned);
                  return;
                }
              }
            }
          } catch {
            // Ignore per-frame detection issues.
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!videoRef.current) {
        setScannerError("Scanner preview failed to initialize.");
        return;
      }

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      zxingReaderRef.current = reader;
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        async (result) => {
          if (scanLockRef.current) return;
          const raw = result?.getText?.() || "";
          const cleaned = normalizeIsbn(raw);
          if (cleaned.length >= 8) {
            scanLockRef.current = true;
            await handleBarcodeDetected(cleaned);
          }
        }
      );
      zxingControlsRef.current = controls;
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

  useEffect(() => {
    if (tab !== "books" && showScanner) {
      setShowScanner(false);
    }
  }, [tab, showScanner]);

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
    const counts = Object.entries(book.location_counts || {})
      .filter(([, count]) => Number(count) > 0)
      .sort(([left], [right]) => left.localeCompare(right));
    const fallbackCode = book.location_code || "A1";

    setEditingBook(book);
    setEditForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn || "",
      total_copies: book.total_copies,
      location_code: fallbackCode,
      description: book.description || "",
    });
    setEditLocationMode(counts.length > 1 ? "multi" : "single");
    setEditLocationRows(
      counts.length > 0
        ? counts.map(([location_code, count]) => ({ location_code, count: Number(count) }))
        : [{ location_code: fallbackCode, count: Number(book.available_copies || book.total_copies || 1) }]
    );
  };

  const updateEditLocationRow = (index, patch) => {
    setEditLocationRows(prev => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addEditLocationRow = () => {
    setEditLocationRows(prev => [...prev, { location_code: "A1", count: 1 }]);
  };

  const removeEditLocationRow = (index) => {
    setEditLocationRows(prev => prev.filter((_, i) => i !== index));
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
    const nextTotal = Number(editForm.total_copies);
    const targetAvailable = targetAvailableForEdit;

    const payload = {
        title: editForm.title,
        author: editForm.author,
        isbn: editForm.isbn,
        total_copies: nextTotal,
        location_code: editForm.location_code,
        description: editForm.description,
      };

    if (editLocationMode === "single") {
      if (targetAvailable > 0) {
        payload.location_counts = { [editForm.location_code]: targetAvailable };
      }
    } else {
      if (splitValidationMessage) {
        setError(splitValidationMessage);
        return;
      }

      const counts = {};
      for (const row of editLocationRows) {
        const code = (row.location_code || "").trim().toUpperCase();
        const count = Number(row.count);
        counts[code] = (counts[code] || 0) + count;
      }

      if (Object.keys(counts).length > 0) {
        payload.location_counts = counts;
      }
      if (!counts[editForm.location_code] && Object.keys(counts).length > 0) {
        payload.location_code = Object.keys(counts).sort()[0];
      }
    }

    try {
      await api.put(`/books/${editingBook.id}`, payload);
      setMsg("Book updated successfully.");
      setEditingBook(null);
      setEditForm({});
      setEditLocationRows([]);
      setEditLocationMode("single");
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

  const checkedOutForEdit = editingBook
    ? Math.max(0, Number(editingBook.total_copies || 0) - Number(editingBook.available_copies || 0))
    : 0;
  const targetAvailableForEdit = editingBook
    ? Math.max(0, Number(editForm.total_copies || 0) - checkedOutForEdit)
    : 0;
  const splitRowsTotal = editLocationRows.reduce((sum, row) => sum + Number(row.count || 0), 0);

  const splitValidationMessage = (() => {
    if (!editingBook || editLocationMode !== "multi") return "";
    if (editLocationRows.length === 0) return "Add at least one split location row.";

    for (const row of editLocationRows) {
      const code = (row.location_code || "").trim().toUpperCase();
      const count = Number(row.count);
      if (!SHELF_OPTIONS.includes(code)) return "Each split location must be a valid A1-D6 shelf.";
      if (!Number.isInteger(count) || count < 1) {
        return "Each split location count must be an integer greater than or equal to 1.";
      }
    }

    if (splitRowsTotal !== targetAvailableForEdit) {
      return `Split rows total is ${splitRowsTotal}, but available copies is ${targetAvailableForEdit}. Adjust rows so they match.`;
    }

    return "";
  })();

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

          {isPhone && (
            <div style={styles.scannerWrap}>
              <div style={styles.scannerHeader}>
                <h4 style={{ margin: 0 }}>Barcode Scanner (Phone)</h4>
                {!showScanner ? (
                  <button type="button" style={styles.btn} onClick={() => setShowScanner(true)}>Scan Barcode</button>
                ) : (
                  <button type="button" style={{ ...styles.btn, background: "#555" }} onClick={() => setShowScanner(false)}>Stop Scanner</button>
                )}
              </div>

              <p style={styles.scannerHint}>
                Scanning auto-fetches title and author from Google Books, then adds the book.
              </p>

              {scannerError && <p style={styles.error}>{scannerError}</p>}

              {showScanner && (
                <div style={styles.scannerPreviewWrap}>
                  <video ref={videoRef} style={styles.scannerVideo} muted playsInline autoPlay />
                </div>
              )}
            </div>
          )}

          <h3>All Books</h3>
          <input style={{...styles.input, marginBottom:"1rem", maxWidth:"300px"}} placeholder="Search…"
            onChange={e => { const q = e.target.value.toLowerCase();
              document.querySelectorAll("[data-book-row]").forEach(r => {
                r.style.display = r.dataset.title.toLowerCase().includes(q) ? "" : "none";
              }); }} />

          {isPhone ? (
            <div style={styles.mobileBookList}>
              {books.map((b) => (
                <div key={b.id} style={styles.mobileBookCard} data-book-row="" data-title={b.title}>
                  <div style={styles.mobileBookTitle}>{b.title}</div>
                  <div style={styles.mobileBookMeta}>{b.author}</div>
                  <div style={styles.mobileBookMeta}>ISBN: {b.isbn || "—"}</div>
                  <div style={styles.mobileBookRow}>
                    <span style={styles.mobileBookLabel}>Location</span>
                    <span style={styles.badge}>{locationSummary(b)}</span>
                  </div>
                  <div style={styles.mobileBookRow}>
                    <span style={styles.mobileBookLabel}>Copies</span>
                    <span style={{
                      fontWeight:"600",
                      color: b.available_copies === 0 ? "#c00" : b.available_copies < b.total_copies ? "#b86000" : "#080"
                    }}>
                      {b.available_copies}/{b.total_copies}
                    </span>
                  </div>
                  <div style={{ ...styles.rowActions, marginTop:"0.6rem" }}>
                    <button style={styles.btnSecondary} onClick={() => handleEditBook(b)}>Edit</button>
                    <button style={styles.btnDanger} onClick={() => handleDelete(b.id, b.title)}>Delete</button>
                  </div>
                </div>
              ))}
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
                {books.map(b => (
                  <tr key={b.id} style={styles.row} data-book-row="" data-title={b.title}>
                    <td>{b.title}</td>
                    <td>{b.author}</td>
                    <td style={{fontSize:"0.85rem",color:"#888"}}>{b.isbn || "—"}</td>
                    <td>
                      <span style={styles.badge}>{locationSummary(b)}</span>
                    </td>
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
          )}

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
                <select
                  style={{ ...styles.modalInput, ...(editLocationMode === "multi" ? styles.modalInputDisabled : {}) }}
                  value={editForm.location_code}
                  disabled={editLocationMode === "multi"}
                  onChange={e => setEditForm({...editForm, location_code: e.target.value})}>
                  {SHELF_OPTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
                {editLocationMode === "multi" && (
                  <p style={styles.locationHintMuted}>Disabled in split mode. Set locations using rows below.</p>
                )}
              </div>
              <div>
                <label style={styles.label}>Description</label>
                <input style={styles.modalInput} type="text" value={editForm.description}
                  onChange={e => setEditForm({...editForm, description: e.target.value})} />
              </div>
            </div>

            <div style={styles.locationModeWrap}>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="edit-location-mode"
                  checked={editLocationMode === "single"}
                  onChange={() => setEditLocationMode("single")}
                />
                Keep all available copies in one location
              </label>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  name="edit-location-mode"
                  checked={editLocationMode === "multi"}
                  onChange={() => {
                    setEditLocationMode("multi");
                    if (editLocationRows.length === 0) {
                      setEditLocationRows([{ location_code: editForm.location_code || "A1", count: 1 }]);
                    }
                  }}
                />
                Split available copies across multiple locations
              </label>

              {editLocationMode === "multi" && (
                <div style={styles.locationRowsWrap}>
                  {editLocationRows.map((row, index) => (
                    <div key={`row-${index}`} style={styles.locationRow}>
                      <select
                        style={styles.modalInput}
                        value={row.location_code}
                        onChange={e => updateEditLocationRow(index, { location_code: e.target.value })}
                      >
                        {SHELF_OPTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                      </select>
                      <input
                        style={styles.modalInput}
                        type="number"
                        min="1"
                        value={row.count}
                        onChange={e => updateEditLocationRow(index, { count: e.target.value })}
                      />
                      <button
                        type="button"
                        style={styles.btnDanger}
                        onClick={() => removeEditLocationRow(index)}
                        disabled={editLocationRows.length === 1}
                        title="Remove location row"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <button type="button" style={styles.btnSecondary} onClick={addEditLocationRow}>Add Location Row</button>
                  <p style={styles.locationHint}>
                    Checked out: {checkedOutForEdit} • Available to place: {targetAvailableForEdit} • Split total: {splitRowsTotal}
                  </p>
                  {splitValidationMessage && <p style={styles.locationError}>{splitValidationMessage}</p>}
                </div>
              )}
            </div>

            <div style={{display:"flex", gap:"0.5rem", justifyContent:"flex-end"}}>
              <button style={{...styles.btn, background:"#888"}} onClick={() => setEditingBook(null)}>Cancel</button>
              <button style={styles.btn} onClick={handleSaveEdit} disabled={editLocationMode === "multi" && !!splitValidationMessage}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SCANNER STOCK MODAL ───────────────────────────────────── */}
      {scannerStockModal.open && (
        <div style={styles.modalOverlay} onClick={() => closeScannerStockModal(null)}>
          <div style={styles.scannerStockModalContent} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin:"0 0 0.35rem" }}>Scanned Book Placement</h3>
            <p style={styles.scannerStockSub}>Choose where to place stock for: <strong>{scannerStockModal.title}</strong></p>

            <div style={styles.scannerStockFields}>
              <div>
                <label style={styles.label}>Shelf Location</label>
                <select
                  style={styles.modalInput}
                  value={scannerStockModal.location_code}
                  onChange={e => setScannerStockModal(prev => ({ ...prev, location_code: e.target.value }))}
                >
                  {SHELF_OPTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </div>
              <div>
                <label style={styles.label}>Stock Quantity</label>
                <input
                  style={styles.modalInput}
                  type="number"
                  min="1"
                  value={scannerStockModal.quantity}
                  onChange={e => setScannerStockModal(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
            </div>

            <div style={styles.scannerStockActions}>
              <button style={{ ...styles.btn, background:"#888" }} onClick={() => closeScannerStockModal(null)}>Cancel</button>
              <button
                style={styles.btn}
                onClick={() => {
                  const quantity = Number.parseInt(String(scannerStockModal.quantity), 10);
                  if (!Number.isInteger(quantity) || quantity < 1) {
                    setError("Stock quantity must be a whole number of at least 1.");
                    return;
                  }
                  closeScannerStockModal({
                    locationCode: scannerStockModal.location_code,
                    quantity,
                  });
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHECKOUTS TAB ────────────────────────────────────────────── */}
      {tab === "checkouts" && (
        <>
          <h3>Currently Checked Out</h3>
          {isPhone ? (
            <div style={styles.mobileCheckoutList}>
              {checkouts.length === 0 && (
                <div style={styles.mobileBookEmpty}>Nothing checked out.</div>
              )}
              {checkouts.map((c) => (
                <div key={c.id} style={styles.mobileCheckoutCard}>
                  <div style={styles.mobileBookTitle}>{c.book_title}</div>
                  <div style={styles.mobileBookMeta}>User: {c.user_email}</div>
                  <div style={styles.mobileBookRow}>
                    <span style={styles.mobileBookLabel}>Location</span>
                    <span style={styles.badge}>{c.book_location || "—"}</span>
                  </div>
                  <div style={styles.mobileBookRow}>
                    <span style={styles.mobileBookLabel}>Checked Out</span>
                    <span style={styles.mobileCheckoutDate}>{fmt(c.checked_out_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
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
          )}
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
  modalInputDisabled: { background:"#f3f4f6", color:"#6b7280", cursor:"not-allowed" },
  locationModeWrap: { marginBottom:"1rem", borderTop:"1px solid #eee", paddingTop:"1rem", display:"grid", gap:"0.5rem" },
  radioLabel: { display:"flex", alignItems:"center", gap:"0.5rem", fontSize:"0.92rem", color:"#333" },
  locationRowsWrap: { display:"grid", gap:"0.5rem", marginTop:"0.25rem" },
  locationRow: { display:"grid", gridTemplateColumns:"1fr 120px auto", gap:"0.5rem", alignItems:"center" },
  scannerStockModalContent: { background:"#fff", borderRadius:"10px", padding:"1.25rem", maxWidth:"440px", width:"92vw", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" },
  scannerStockSub: { margin:"0 0 0.9rem", color:"#475569", fontSize:"0.9rem" },
  scannerStockFields: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.65rem", marginBottom:"1rem" },
  scannerStockActions: { display:"flex", justifyContent:"flex-end", gap:"0.5rem" },
  locationHint: { margin:"0.1rem 0 0", color:"#666", fontSize:"0.82rem" },
  locationHintMuted: { margin:"0.35rem 0 0", color:"#6b7280", fontSize:"0.78rem" },
  locationError: { margin:"0.2rem 0 0", color:"#b91c1c", fontSize:"0.82rem", fontWeight:"600" },
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
  mobileBookList: { display:"grid", gap:"0.7rem" },
  mobileBookCard: { border:"1px solid #e5e7eb", borderRadius:10, background:"#fff", padding:"0.75rem" },
  mobileBookTitle: { fontSize:"0.95rem", fontWeight:"700", color:"#0f172a", marginBottom:"0.2rem" },
  mobileBookMeta: { fontSize:"0.82rem", color:"#64748b", marginBottom:"0.2rem", wordBreak:"break-word" },
  mobileBookRow: { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"0.5rem", marginTop:"0.35rem" },
  mobileBookLabel: { fontSize:"0.8rem", color:"#475569", fontWeight:"600" },
  mobileBookEmpty: { textAlign:"center", color:"#888", padding:"1rem", border:"1px dashed #d1d5db", borderRadius:8 },
  mobileCheckoutList: { display:"grid", gap:"0.7rem" },
  mobileCheckoutCard: { border:"1px solid #e5e7eb", borderRadius:10, background:"#fff", padding:"0.75rem" },
  mobileCheckoutDate: { fontSize:"0.85rem", color:"#0f172a", fontWeight:"600" },
  scannerWrap: { marginBottom:"1.25rem", border:"1px solid #dbe3f1", borderRadius:"10px", padding:"0.8rem", background:"#f8fbff" },
  scannerHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", gap:"0.5rem" },
  scannerHint: { margin:"0.45rem 0 0.6rem", color:"#45556f", fontSize:"0.86rem" },
  scannerPreviewWrap: { borderRadius:"8px", overflow:"hidden", border:"1px solid #cbd5e1", background:"#111827" },
  scannerVideo: { width:"100%", display:"block", maxHeight:"280px", objectFit:"cover" },
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
