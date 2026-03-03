import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import api from "../api/client";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the URL.");
      return;
    }
    api.get(`/auth/verify/${token}`)
      .then(({ data }) => { setStatus("success"); setMessage(data.message); })
      .catch((err)     => { setStatus("error");
                            setMessage(err.response?.data?.error || "Verification failed."); });
  }, []);

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {status === "verifying" && <p>Verifying your email…</p>}
        {status === "success"   && (
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
  link:    { display:"inline-block", marginTop:"1rem", color:"#003087", fontWeight:"bold" },
};
