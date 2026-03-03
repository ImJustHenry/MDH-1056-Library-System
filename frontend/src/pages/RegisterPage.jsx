import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [debugUrl, setDebugUrl] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setDebugUrl("");
    setLoading(true);
    try {
      const data = await register(email, password);
      setSuccess(data.message);
      if (data.debug_verify_url) setDebugUrl(data.debug_verify_url);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.title}>Create Account</h2>
        <p style={styles.sub}>Must use an @slu.edu email address</p>

        {error   && <p style={styles.error}>{error}</p>}
        {success && (
          <div style={styles.success}>
            <p>{success}</p>
            {debugUrl && (
              <p style={{fontSize:"0.85rem"}}>
                <strong>Dev verify link: </strong>
                <a href={debugUrl} target="_blank" rel="noreferrer">Click to verify</a>
              </p>
            )}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" value={email}
              onChange={e => setEmail(e.target.value)} required
              placeholder="yourname@slu.edu" />

            <label style={styles.label}>Password (min 8 chars)</label>
            <input style={styles.input} type="password" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={8} />

            <button style={styles.btn} disabled={loading}>
              {loading ? "Registering…" : "Register"}
            </button>
          </form>
        )}

        <p style={styles.footer}>
          Already have an account? <Link to="/login">Sign in</Link>
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
  success: { background:"#eaffea", color:"#080", padding:"0.75rem",
             borderRadius:"4px", marginBottom:"1rem", fontSize:"0.9rem" },
  footer:  { textAlign:"center", marginTop:"1rem", fontSize:"0.9rem" },
};
