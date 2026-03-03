import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { useCart } from "../context/CartContext";

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, clearCart, totalItems } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setError(""); setSuccess(""); setLoading(true);
    try {
      const payload = cart.map(i => ({ book_id: i.id, quantity: i.quantity }));
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
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
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
};
