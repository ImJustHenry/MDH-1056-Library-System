import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useCart } from "../context/CartContext";

export default function CartPage() {
  const { cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [locationPicker, setLocationPicker] = useState({
    open: false,
    item: null,
    options: [],
    selected: "",
  });

  const locationSummary = (item) => {
    const counts = item.location_counts || {};
    const entries = Object.entries(counts).filter(([, count]) => Number(count) > 0);
    if (entries.length === 0) return item.location_code || "Unknown";
    return entries
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, count]) => `${code}:${count}`)
      .join(", ");
  };

  const getLocationOptions = (item) => {
    const counts = item.location_counts || {};
    return Object.entries(counts)
      .filter(([, count]) => Number(count) > 0)
      .sort(([left], [right]) => left.localeCompare(right));
  };

  const handleAddCopy = (item) => {
    setError("");
    const entries = getLocationOptions(item);
    if (entries.length <= 1) {
      const fallback = entries[0]?.[0] || item.location_code || "A1";
      addToCart(item, fallback);
      return;
    }

    setLocationPicker({
      open: true,
      item,
      options: entries,
      selected: entries[0][0],
    });
  };

  const handleConfirmLocationPick = () => {
    if (!locationPicker.item || !locationPicker.selected) return;
    addToCart(locationPicker.item, locationPicker.selected);
    setLocationPicker({ open: false, item: null, options: [], selected: "" });
  };

  const handleCancelLocationPick = () => {
    setLocationPicker({ open: false, item: null, options: [], selected: "" });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setError(""); setSuccess(""); setLoading(true);

    const payload = [];
    const chosenLines = [];

    for (const item of cart) {
      const selectedCounts = { ...(item.selected_location_counts || {}) };
      const selectedTotal = Object.values(selectedCounts).reduce((sum, count) => sum + Number(count || 0), 0);

      const fallback = item.location_code || "A1";
      if (selectedTotal < item.quantity) {
        selectedCounts[fallback] = Number(selectedCounts[fallback] || 0) + (item.quantity - selectedTotal);
      }

      const chosenEntries = Object.entries(selectedCounts)
        .filter(([, count]) => Number(count) > 0)
        .sort(([left], [right]) => left.localeCompare(right));

      if (chosenEntries.length === 0) {
        payload.push({ book_id: item.id, quantity: item.quantity, location_code: fallback });
        chosenLines.push(`• ${item.title} (x${item.quantity}) → ${fallback}`);
      } else {
        chosenEntries.forEach(([code, count]) => {
          payload.push({ book_id: item.id, quantity: Number(count), location_code: code });
        });
        chosenLines.push(`• ${item.title} (x${item.quantity}) → ${chosenEntries.map(([code, count]) => `${code}:${count}`).join(", ")}`);
      }
    }

    const locationLines = chosenLines.length > 0
      ? chosenLines
      : cart.map((item) => `• ${item.title} (x${item.quantity}) → ${locationSummary(item)}`);
    const proceed = window.confirm(
      `Shelf locations for pickup:\n\n${locationLines.join("\n")}\n\nContinue checkout?`
    );
    if (!proceed) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.post("/checkouts/cart-checkout", payload);
      setSuccess(`${data.checked_out} book cop${data.checked_out !== 1 ? "ies" : "y"} checked out successfully!`);
      clearCart();
    } catch (err) {
      setError(err.response?.data?.error || "Checkout failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      <h2 style={{ marginBottom: "0.25rem" }}>My Cart</h2>
      <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        {totalItems > 0
          ? `${totalItems} item${totalItems !== 1 ? "s" : ""} — review and checkout below`
          : "Your cart is empty."}
      </p>

      {error   && <div style={s.error}>{error}</div>}
      {success && (
        <div style={s.success}>
          {success}{" "}
          <Link to="/checkouts" style={{ color: "#080", fontWeight: "bold" }}>View My Checkouts →</Link>
        </div>
      )}

      {cart.length === 0 && !success && (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "#888" }}>
          <p style={{ fontSize: "3rem", margin: 0 }}>🛒</p>
          <p>Nothing here yet. <Link to="/books">Browse books</Link> to add some.</p>
        </div>
      )}

      {cart.length > 0 && (
        <>
          <table style={s.table}>
            <thead>
              <tr style={s.header}>
                <th style={s.th}>Title</th>
                <th style={s.th}>Author</th>
                <th style={{...s.th, textAlign:"center"}}>Qty</th>
                <th style={{...s.th, textAlign:"center"}}>Avail.</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item.id} style={s.row}>
                  <td style={s.td}><strong>{item.title}</strong></td>
                  <td style={s.td}>{item.author}</td>
                  <td style={{...s.td, textAlign:"center"}}>
                    <div style={s.qtyRow}>
                      <button style={s.qtyBtn}
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                      <span style={s.qtyNum}>{item.quantity}</span>
                      <button style={s.qtyBtn}
                        disabled={item.quantity >= item.available_copies}
                        onClick={() => handleAddCopy(item)}>+</button>
                    </div>
                  </td>
                  <td style={{...s.td, textAlign:"center", color:"#555", fontSize:"0.85rem"}}>
                    {item.available_copies}
                  </td>
                  <td style={s.td}>
                    <button style={s.removeBtn}
                      onClick={() => removeFromCart(item.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Summary bar */}
          <div style={s.summary}>
            <button style={s.clearBtn} onClick={clearCart}>Clear Cart</button>
            <div style={s.summaryRight}>
              <span style={{ color: "#555", fontSize: "0.95rem" }}>
                Total: <strong>{totalItems}</strong> cop{totalItems !== 1 ? "ies" : "y"}
              </span>
              <button style={s.checkoutBtn} disabled={loading} onClick={handleCheckout}>
                {loading ? "Checking out…" : `Checkout ${totalItems} Item${totalItems !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>

          {locationPicker.open && (
            <div style={s.pickerOverlay} onClick={handleCancelLocationPick}>
              <div style={s.pickerCard} onClick={(event) => event.stopPropagation()}>
                <h4 style={{ margin: "0 0 0.5rem" }}>Select Pickup Location</h4>
                <p style={{ margin: "0 0 0.7rem", color: "#555", fontSize: "0.9rem" }}>
                  {locationPicker.item?.title}
                </p>
                <select
                  style={s.selectLike}
                  value={locationPicker.selected}
                  onChange={(event) => setLocationPicker((prev) => ({ ...prev, selected: event.target.value }))}
                >
                  {locationPicker.options.map(([code, count]) => (
                    <option key={code} value={code}>{code} ({count} available)</option>
                  ))}
                </select>
                <div style={s.pickerActions}>
                  <button style={s.clearBtn} onClick={handleCancelLocationPick}>Cancel</button>
                  <button style={s.checkoutBtn} onClick={handleConfirmLocationPick}>Add Copy</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const s = {
  table:       { width: "100%", borderCollapse: "collapse", marginBottom: "1rem" },
  header:      { background: "#f0f4f8" },
  th:          { padding: "0.6rem 0.75rem", textAlign: "left", fontWeight: "600", fontSize: "0.9rem" },
  row:         { borderBottom: "1px solid #eee" },
  td:          { padding: "0.65rem 0.75rem", fontSize: "0.95rem" },
  qtyRow:      { display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" },
  qtyBtn:      { width: 28, height: 28, border: "1px solid #ccc", borderRadius: 4,
                 background: "#f5f5f5", cursor: "pointer", fontSize: "1rem", fontWeight: "bold",
                 lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  qtyNum:      { minWidth: 24, textAlign: "center", fontWeight: "600" },
  removeBtn:   { padding: "0.3rem 0.7rem", background: "none", color: "#c00",
                 border: "1px solid #c00", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" },
  summary:     { display: "flex", justifyContent: "space-between", alignItems: "center",
                 padding: "1rem 0", borderTop: "2px solid #eee", marginTop: "0.5rem" },
  summaryRight:{ display: "flex", gap: "1rem", alignItems: "center" },
  clearBtn:    { padding: "0.5rem 1rem", background: "none", color: "#666",
                 border: "1px solid #ccc", borderRadius: 4, cursor: "pointer" },
  checkoutBtn: { padding: "0.6rem 1.5rem", background: "#003087", color: "#fff",
                 border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: "0.95rem" },
  success:     { background: "#eaffea", color: "#080", padding: "0.75rem 1rem",
                 borderRadius: 4, marginBottom: "1rem" },
  error:       { background: "#ffeaea", color: "#c00", padding: "0.75rem 1rem",
                 borderRadius: 4, marginBottom: "1rem" },
  pickerOverlay:{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1200 },
  pickerCard:   { width:"92vw", maxWidth:360, background:"#fff", borderRadius:10, padding:"1rem", boxShadow:"0 20px 50px rgba(0,0,0,0.25)" },
  pickerActions:{ marginTop:"0.8rem", display:"flex", justifyContent:"flex-end", gap:"0.5rem" },
  selectLike:   { width:"100%", padding:"0.5rem 0.75rem", border:"1px solid #ccc", borderRadius:4, fontSize:"0.95rem" },
};
