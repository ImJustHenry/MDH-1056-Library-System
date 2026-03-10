import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../api/client";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  // "idle" = waiting for user click, "loading", "success", "error"
  const [status,  setStatus]  = useState("idle");
  const [message, setMessage] = useState("");

  const token = searchParams.get("token");

  const handleVerify = () => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the URL.");
      return;
    }
    setStatus("loading");
    api.get(`/auth/verify/${token}`)
      .then(({ data }) => { setStatus("success"); setMessage(data.message); })
      .catch((err)     => { setStatus("error");
                            setMessage(err.response?.data?.error || "Verification failed."); });
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {status === "idle" && (
          <>
            <h2 style={{ color:"#003087" }}>Verify Your Email</h2>
            <p>Click the button below to confirm your email address.</p>
            <button onClick={handleVerify} style={styles.btn}>
              Verify Email
            </button>
          </>
        )}
        {status === "loading" && <p>Verifying your email…</p>}
        {status === "success" && (
          <>
            <h2 style={{ color:"#080" }}>✓ Email Verified</h2>
            <p>{message}</p>
            <Link to="/login" style={styles.link}>Go to Login →</Link>
          </>
        )}
        {status === "error" && (
          <>
            <h2 style={{ color:"#c00" }}>Verification Failed</h2>
            <p>{message}</p>
            <Link to="/register" style={styles.link}>Register again →</Link>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { display:"flex", justifyContent:"center", alignItems:"center", minHeight:"80vh" },
  card:    { background:"#fff", padding:"2rem", borderRadius:"8px",
             boxShadow:"0 2px 12px rgba(0,0,0,0.1)", textAlign:"center", maxWidth:"380px" },
  btn:     { marginTop:"1rem", padding:"0.75rem 2rem", background:"#003087", color:"#fff",
             border:"none", borderRadius:"4px", fontSize:"1rem", cursor:"pointer" },
  link:    { display:"inline-block", marginTop:"1rem", color:"#003087", fontWeight:"bold" },
};
