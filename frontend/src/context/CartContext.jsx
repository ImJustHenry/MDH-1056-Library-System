import { createContext, useContext, useState } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]); // [{ id, title, author, available_copies, quantity }]

  // Add one copy to cart (or increment if already there)
  const addToCart = (book) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === book.id);
      if (existing) {
        if (existing.quantity >= existing.available_copies) return prev; // cap at available
        return prev.map(i =>
          i.id === book.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      if (book.available_copies < 1) return prev;
      return [...prev, { ...book, quantity: 1 }];
    });
  };

  const removeFromCart = (bookId) =>
    setCart(prev => prev.filter(i => i.id !== bookId));

  const updateQuantity = (bookId, qty) => {
    if (qty < 1) { removeFromCart(bookId); return; }
    setCart(prev =>
      prev.map(i =>
        i.id === bookId
          ? { ...i, quantity: Math.min(qty, i.available_copies) }
          : i
      )
    );
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
