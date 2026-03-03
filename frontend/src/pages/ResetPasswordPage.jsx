import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import api from "../api/client";

export default function ResetPasswordPage() {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const token                   = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit() {
    setError("");
    if (!token)                      { setError("Invalid or missing reset token."); return; }
    if (password.length < 8)         { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm)        { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await api.post("/auth/reset-password", { token, password });
      setSuccess(res.data.message);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "2rem", border: "1px solid #ddd", borderRadius: 8 }}>
      <h2 style={{ marginBottom: "1.5rem" }}>Reset Password</h2>

      {success ? (
        <div>
          <p style={{ color: "green" }}>{success}</p>
          <p style={{ marginTop: "0.5rem", color: "#555" }}>Redirecting you to sign in…</p>
        </div>
      ) : (
        <>
          {!token && (
            <p style={{ color: "red" }}>
              Invalid reset link. Please request a new one{" "}
              <Link to="/forgot-password">here</Link>.
            </p>
          )}

          {error && <p style={{ color: "red", marginBottom: "0.75rem" }}>{error}</p>}

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: 4 }}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Minimum 8 characters"
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box", borderRadius: 4, border: "1px solid #ccc" }}
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: 4 }}>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Re-enter new password"
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box", borderRadius: 4, border: "1px solid #ccc" }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !token}
            style={{ width: "100%", padding: "0.6rem", background: "#007bff", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>

          <p style={{ textAlign: "center", marginTop: "0.75rem" }}>
            <Link to="/login">Back to Sign In</Link>
          </p>
        </>
      )}
    </div>
  );
}
