import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import { useAuth } from "../context/AuthContext";

const SITE_KEY = "6LeNIH4sAAAAAGDOforW2BRSfdmP5bxN_o88uai6";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const captchaRef = useRef(null);

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!captchaToken) {
      setError("Please complete the CAPTCHA.");
      return;
    }
    setLoading(true);
    try {
      const loggedInUser = await login(email, password, captchaToken);
      navigate(loggedInUser.role === "admin" ? "/dashboard" : "/books", { replace: true });
    } catch (err) {
      // reset captcha so user must solve it again
      captchaRef.current?.reset();
      setCaptchaToken("");
      if (err.response?.status === 429) {
        setError("Too many login attempts. Please wait a minute and try again.");
      } else {
        setError(err.response?.data?.error || "Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.title}>Sign In</h2>
        <p style={styles.sub}>MDH 1056 Library System - @slu.edu only</p>

        {error && <div style={styles.error}>{error}</div>}

        <div>
          <label style={styles.label}>Email</label>
          <input style={styles.input} type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email" />

          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" />

          <div style={{ marginBottom: "1rem" }}>
            <ReCAPTCHA
              ref={captchaRef}
              sitekey={SITE_KEY}
              onChange={token => setCaptchaToken(token || "")}
              onExpired={() => setCaptchaToken("")}
            />
          </div>

          <button style={styles.btn} disabled={loading} onClick={handleSubmit}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
        <p style={styles.footer}>
          No account? <Link to="/register">Register</Link>
        </p>
        <p style={{...styles.footer, marginTop:"0.5rem"}}>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { display:"flex", justifyContent:"center", alignItems:"center", minHeight:"80vh" },
  card:    { background:"#fff", padding:"2rem", borderRadius:"8px",
             boxShadow:"0 2px 12px rgba(0,0,0,0.1)", width:"100%", maxWidth:"400px" },
  title:   { margin:"0 0 0.25rem", color:"#003087" },
  sub:     { margin:"0 0 1.25rem", color:"#666", fontSize:"0.85rem" },
  label:   { display:"block", marginBottom:"0.25rem", fontWeight:"600",
             fontSize:"0.9rem", color:"#333" },
  input:   { width:"100%", padding:"0.6rem 0.75rem", marginBottom:"1rem",
             border:"1px solid #ccc", borderRadius:"4px", fontSize:"1rem",
             boxSizing:"border-box" },
  btn:     { width:"100%", padding:"0.75rem", background:"#003087", color:"#fff",
             border:"none", borderRadius:"4px", fontSize:"1rem", cursor:"pointer" },
  error:   { background:"#ffeaea", color:"#c00", padding:"0.6rem 0.75rem",
             borderRadius:"4px", marginBottom:"1rem", fontSize:"0.9rem" },
  footer:  { textAlign:"center", marginTop:"1rem", fontSize:"0.9rem" },
};
