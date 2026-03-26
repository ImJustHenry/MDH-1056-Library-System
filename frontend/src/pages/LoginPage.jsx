import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import { useAuth } from "../context/AuthContext";

const SITE_KEY = "6LeNIH4sAAAAAGDOforW2BRSfdmP5bxN_o88uai6";
const PHONE_CAPTCHA_BREAKPOINT = 500;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const captchaRef = useRef(null);
  const [isPhone, setIsPhone] = useState(window.innerWidth <= PHONE_CAPTCHA_BREAKPOINT);
  const isInvisibleCaptcha = isPhone;
  const [forceVisibleCaptcha, setForceVisibleCaptcha] = useState(false);
  const useInvisibleCaptcha = isInvisibleCaptcha && !forceVisibleCaptcha;
  const [captchaRenderKey, setCaptchaRenderKey] = useState(0);
  const [captchaAutoRetryCount, setCaptchaAutoRetryCount] = useState(0);
  const [captchaLoadError, setCaptchaLoadError] = useState("");
  const [captchaReady, setCaptchaReady] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth <= PHONE_CAPTCHA_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);

  const handleSubmit = async () => {
    setError("");

    // Check readiness for both invisible and visible modes
    if (!captchaReady) {
      setError("Human verification is still loading. Please wait a moment.");
      return;
    }

    setLoading(true);

    let tokenToUse = captchaToken;
    if (!tokenToUse && useInvisibleCaptcha) {
      try {
        console.log("[LoginPage] Executing invisible CAPTCHA...");
        tokenToUse = await captchaRef.current?.executeAsync();
        console.log("[LoginPage] Invisible CAPTCHA token obtained:", !!tokenToUse);
        setCaptchaToken(tokenToUse || "");
      } catch (err) {
        console.error("[LoginPage] Invisible CAPTCHA executeAsync failed:", err);
        tokenToUse = "";
      }

      if (!tokenToUse) {
        setLoading(false);
        console.log("[LoginPage] Switching to visible CAPTCHA mode...");
        setForceVisibleCaptcha(true);
        setCaptchaReady(false);
        setCaptchaToken("");
        setCaptchaRenderKey(prev => prev + 1);
        setError("Phone verification switched to manual mode. Please complete the CAPTCHA and try again.");
        return;
      }
    }

    if (!tokenToUse) {
      setLoading(false);
      console.error("[LoginPage] No CAPTCHA token available. Token state:", captchaToken);
      setError("Please complete the CAPTCHA and try again.");
      return;
    }

    try {
      console.log("[LoginPage] Submitting login with email:", email);
      const loggedInUser = await login(email, password, tokenToUse);
      console.log("[LoginPage] Login successful, user role:", loggedInUser.role);
      navigate(loggedInUser.role === "admin" ? "/dashboard" : "/books", { replace: true });
    } catch (err) {
      console.error("[LoginPage] Login failed:", err.response?.data || err.message);
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

  const handleRetryCaptcha = () => {
    setCaptchaLoadError("");
    setCaptchaToken("");
    setCaptchaReady(false);
    setCaptchaAutoRetryCount(0);
    setForceVisibleCaptcha(false);
    setCaptchaRenderKey(prev => prev + 1);
  };

  useEffect(() => {
    setCaptchaAutoRetryCount(0);
    setForceVisibleCaptcha(false);
  }, [isPhone]);

  useEffect(() => {
    setCaptchaReady(false);
    setCaptchaLoadError("");
    setCaptchaToken("");
  }, [isPhone, captchaRenderKey]);

  useEffect(() => {
    if (captchaReady || captchaLoadError) return;
    const timer = window.setTimeout(() => {
      if (captchaAutoRetryCount < 1) {
        setCaptchaAutoRetryCount(prev => prev + 1);
        setCaptchaRenderKey(prev => prev + 1);
        return;
      }
      if (isPhone && !forceVisibleCaptcha) {
        setForceVisibleCaptcha(true);
        setCaptchaReady(false);
        setCaptchaToken("");
        setCaptchaRenderKey(prev => prev + 1);
        return;
      }
      setCaptchaLoadError("CAPTCHA is taking too long to load. Tap Retry.");
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [captchaReady, captchaLoadError, captchaRenderKey, isPhone, captchaAutoRetryCount, forceVisibleCaptcha]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.card(isPhone)}>
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

          <div style={styles.captchaShell}>
            <div style={styles.captchaWrap}>
              <ReCAPTCHA
                key={`${isPhone ? "phone" : "desktop"}-${captchaRenderKey}`}
                ref={captchaRef}
                sitekey={SITE_KEY}
                size={useInvisibleCaptcha ? "invisible" : "normal"}
                badge={useInvisibleCaptcha ? "bottomright" : undefined}
                asyncScriptOnLoad={() => {
                  console.log("[ReCAPTCHA] Script loaded, mode:", useInvisibleCaptcha ? "invisible" : "visible");
                  setCaptchaReady(true);
                  setCaptchaLoadError("");
                }}
                onChange={token => {
                  console.log("[ReCAPTCHA] User completed CAPTCHA, token obtained:", !!token);
                  setCaptchaToken(token || "");
                }}
                onExpired={() => {
                  console.log("[ReCAPTCHA] Token expired");
                  setCaptchaToken("");
                }}
                onErrored={() => {
                  console.error("[ReCAPTCHA] Error occurred");
                  setCaptchaReady(false);
                  setCaptchaToken("");
                  if (isPhone && !forceVisibleCaptcha) {
                    console.log("[ReCAPTCHA] Auto-switching to visible mode due to error...");
                    setForceVisibleCaptcha(true);
                    setCaptchaRenderKey(prev => prev + 1);
                    return;
                  }
                  setCaptchaLoadError("CAPTCHA failed to load on this network/browser. Tap Retry.");
                }}
              />
            </div>
            {!captchaReady && !captchaLoadError && (
              <div style={styles.captchaHint}>
                Loading human verification…
              </div>
            )}
            {isPhone && forceVisibleCaptcha && !captchaLoadError && (
              <div style={styles.captchaHint}>
                Switched to manual verification mode for better phone compatibility.
              </div>
            )}
            {captchaLoadError && (
              <div style={styles.captchaErrorRow}>
                <span style={styles.captchaErrorText}>{captchaLoadError}</span>
                <button type="button" style={styles.retryBtn} onClick={handleRetryCaptcha}>Retry</button>
              </div>
            )}
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

        <button type="button" style={styles.debugToggle} onClick={() => setShowDebug(!showDebug)}>
          {showDebug ? "Hide Debug" : "Show Debug"}
        </button>

        {showDebug && (
          <div style={styles.debugPanel}>
            <strong>📱 Debug Info:</strong>
            <div>Window width: {window.innerWidth}px</div>
            <div>isPhone: {isPhone ? "✓ Yes" : "✗ No"}</div>
            <div>CAPTCHA mode: {useInvisibleCaptcha ? "Invisible" : "Visible"}</div>
            <div>forceVisibleCaptcha: {forceVisibleCaptcha ? "✓ ON" : "✗ OFF"}</div>
            <div>captchaReady: {captchaReady ? "✓ YES" : "✗ NO"}</div>
            <div>captchaToken: {captchaToken ? `✓ Got ${captchaToken.substring(0, 10)}...` : "✗ None"}</div>
            <div>error: {error ? `⚠️ ${error}` : "None"}</div>
            <div>loading: {loading ? "✓ Yes" : "✗ No"}</div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { display:"flex", justifyContent:"center", alignItems:"center", minHeight:"80vh" },
  card:    (isPhone) => ({ background:"#fff", padding:isPhone ? "1.25rem" : "2rem", borderRadius:"8px",
             boxShadow:"0 2px 12px rgba(0,0,0,0.1)", width:"100%", maxWidth:"400px" }),
  title:   { margin:"0 0 0.25rem", color:"#003087" },
  sub:     { margin:"0 0 1.25rem", color:"#666", fontSize:"0.85rem" },
  label:   { display:"block", marginBottom:"0.25rem", fontWeight:"600",
             fontSize:"0.9rem", color:"#333" },
  input:   { width:"100%", padding:"0.6rem 0.75rem", marginBottom:"1rem",
             border:"1px solid #ccc", borderRadius:"4px", fontSize:"1rem",
             boxSizing:"border-box" },
  btn:     { width:"100%", padding:"0.75rem", background:"#003087", color:"#fff",
             border:"none", borderRadius:"4px", fontSize:"1rem", cursor:"pointer" },
  retryBtn: { padding:"0.35rem 0.7rem", background:"#fff", color:"#003087",
             border:"1px solid #003087", borderRadius:"4px", fontSize:"0.82rem", cursor:"pointer" },
  captchaShell: { marginBottom:"1rem", minHeight:"84px" },
  captchaWrap: { marginBottom:"1rem", display:"flex", justifyContent:"center" },
  captchaHint: { marginTop:"-0.2rem", marginBottom:"0.4rem", color:"#4b5563", fontSize:"0.8rem", textAlign:"center" },
  captchaErrorRow: { marginTop:"0.4rem", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"0.5rem" },
  captchaErrorText: { color:"#b91c1c", fontSize:"0.8rem", lineHeight:1.3 },
  error:   { background:"#ffeaea", color:"#c00", padding:"0.6rem 0.75rem",
             borderRadius:"4px", marginBottom:"1rem", fontSize:"0.9rem" },
  footer:  { textAlign:"center", marginTop:"1rem", fontSize:"0.9rem" },
  debugToggle: { width:"100%", padding:"0.5rem", marginTop:"1rem", background:"#f0f0f0", 
               color:"#333", border:"1px solid #ccc", borderRadius:"4px", fontSize:"0.8rem", cursor:"pointer" },
  debugPanel: { background:"#f8f8f8", border:"1px solid #ddd", borderRadius:"4px", padding:"0.75rem", 
              marginTop:"0.75rem", fontSize:"0.75rem", fontFamily:"monospace", color:"#333", lineHeight:"1.5" },
};
