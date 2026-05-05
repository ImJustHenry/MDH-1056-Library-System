import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";

import LoginPage          from "./pages/LoginPage";
import RegisterPage       from "./pages/RegisterPage";
import VerifyEmailPage    from "./pages/VerifyEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage  from "./pages/ResetPasswordPage";
import BooksPage          from "./pages/BooksPage";
import CartPage           from "./pages/CartPage";
import CheckoutsPage      from "./pages/CheckoutsPage";
import AdminPage          from "./pages/AdminPage";
import DashboardPage      from "./pages/DashboardPage";
import BarcodePage        from "./pages/BarcodePage";

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Navbar />
          <main style={{ padding: "1.5rem" }}>
            <Routes>
              {/* Public */}
              <Route path="/login"           element={<LoginPage />} />
              <Route path="/register"        element={<RegisterPage />} />
              <Route path="/verify-email"    element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password"  element={<ResetPasswordPage />} />

              {/* User + Admin */}
              <Route element={<ProtectedRoute />}>
                <Route path="/books"     element={<BooksPage />} />
                <Route path="/barcode"   element={<BarcodePage />} />
                <Route path="/cart"      element={<CartPage />} />
                <Route path="/checkouts" element={<CheckoutsPage />} />
              </Route>

              {/* Admin only */}
              <Route element={<ProtectedRoute adminOnly />}>
                <Route path="/admin"     element={<AdminPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>

              {/* Default */}
              <Route path="*" element={<Navigate to="/books" replace />} />
            </Routes>
          </main>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
