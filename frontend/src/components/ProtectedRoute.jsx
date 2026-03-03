import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ adminOnly = false }) {
  const { user } = useAuth();

  // Also fall back to localStorage in case context state hasn't settled yet
  const stored = user || JSON.parse(localStorage.getItem("user") || "null");

  if (!stored) return <Navigate to="/login" replace />;
  if (adminOnly && stored.role !== "admin") return <Navigate to="/books" replace />;
  return <Outlet />;
}
