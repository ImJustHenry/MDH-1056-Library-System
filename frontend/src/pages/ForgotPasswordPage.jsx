import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [message, setMessage]   = useState("");
  const [debugUrl, setDebugUrl] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit() {
    setError("");
    setMessage("");
    setDebugUrl("");
    if (!email) { setError("Please enter your email."); return; }
    setLoading(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setMessage(res.data.message);
      if (res.data.debug_reset_url) setDebugUrl(res.data.debug_reset_url);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "2rem", border: "1px solid #ddd", borderRadius: 8 }}>
      <h2 style={{ marginBottom: "1.5rem" }}>Forgot Password</h2>

      {message ? (
        <div>
          <p style={{ color: "green" }}>{message}</p>
          {debugUrl && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
              <strong>Dev reset link:</strong>{" "}
              <a href={debugUrl}>{debugUrl}</a>
            </p>
          )}
          <p style={{ marginTop: "1rem" }}>
            <Link to="/login">Back to Sign In</Link>
          </p>
        </div>
      ) : (
        <>
          <p style={{ marginBottom: "1rem", color: "#555" }}>
            Enter your @slu.edu email and we will send you a password reset link.
          </p>

          {error && <p style={{ color: "red", marginBottom: "0.75rem" }}>{error}</p>}

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: 4 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="you@slu.edu"
              style={{ width: "100%", padding: "0.5rem", boxSizing: "border-box", borderRadius: 4, border: "1px solid #ccc" }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: "100%", padding: "0.6rem", background: "#007bff", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <p style={{ textAlign: "center", marginTop: "0.75rem" }}>
            <Link to="/login">Back to Sign In</Link>
          </p>
        </>
      )}
    </div>
  );
}
