import { createContext, useContext, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]); // [{ id, title, author, available_copies, quantity, selected_location_counts, selected_locations_order }]

  const pickFallbackLocation = (book) => {
    const counts = book.location_counts || {};
    const entries = Object.entries(counts)
      .filter(([, count]) => Number(count) > 0)
      .sort(([left], [right]) => left.localeCompare(right));
    return entries[0]?.[0] || book.location_code || "A1";
  };

  // Add one copy to cart (or increment if already there)
  const addToCart = (book, selectedLocation = "") => {
    setCart(prev => {
      const existing = prev.find(i => i.id === book.id);
      const locationCode = String(selectedLocation || pickFallbackLocation(book)).trim().toUpperCase();
      const rawMaxAtLocation = Number((book.location_counts || {})[locationCode]);
      const maxAtLocation = Number.isFinite(rawMaxAtLocation) && rawMaxAtLocation > 0
        ? rawMaxAtLocation
        : Number.MAX_SAFE_INTEGER;

      if (existing) {
        if (existing.quantity >= existing.available_copies) return prev; // cap at available
        if (Number(existing.selected_location_counts?.[locationCode] || 0) >= maxAtLocation) return prev;

        return prev.map(i => {
          if (i.id !== book.id) return i;
          const nextCounts = { ...(i.selected_location_counts || {}) };
          nextCounts[locationCode] = Number(nextCounts[locationCode] || 0) + 1;
          return {
            ...i,
            quantity: i.quantity + 1,
            selected_location_counts: nextCounts,
            selected_locations_order: [...(i.selected_locations_order || []), locationCode],
          };
        });
      }

      if (book.available_copies < 1) return prev;

      return [
        ...prev,
        {
          ...book,
          quantity: 1,
          selected_location_counts: { [locationCode]: 1 },
          selected_locations_order: [locationCode],
        },
      ];
    });
  };

  const removeFromCart = (bookId) =>
    setCart(prev => prev.filter(i => i.id !== bookId));

  const updateQuantity = (bookId, qty) => {
    if (qty < 1) { removeFromCart(bookId); return; }

    setCart(prev => prev.map(i => {
      if (i.id !== bookId) return i;

      const desired = Math.min(qty, i.available_copies);
      if (desired >= i.quantity) {
        return { ...i, quantity: desired };
      }

      const removeCount = i.quantity - desired;
      const nextOrder = [...(i.selected_locations_order || [])];
      const nextCounts = { ...(i.selected_location_counts || {}) };

      for (let index = 0; index < removeCount; index += 1) {
        const removedCode = nextOrder.pop();
        if (!removedCode) continue;
        nextCounts[removedCode] = Number(nextCounts[removedCode] || 0) - 1;
        if (nextCounts[removedCode] <= 0) delete nextCounts[removedCode];
      }

      return {
        ...i,
        quantity: desired,
        selected_location_counts: nextCounts,
        selected_locations_order: nextOrder,
      };
    }));
  };

  const clearCart = () => setCart([]);

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, totalItems }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
