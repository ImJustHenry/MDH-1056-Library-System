import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { totalItems }   = useCart();
  const navigate         = useNavigate();
  const location         = useLocation();

  const handleLogout = () => { logout(); navigate("/login"); };
  const active = (path) => location.pathname === path;

  return (
    <header style={s.header}>
      <div style={s.inner}>
        <Link to="/books" style={s.brand}>
          <span>📚</span>
          <span>MDH 1056 Library</span>
        </Link>

        {user && (
          <nav style={s.nav}>
            <Link to="/books"     style={{...s.link, ...(active("/books")     ? s.activeLink : {})}}>Catalog</Link>
            <Link to="/cart"      style={{...s.link, ...(active("/cart")      ? s.activeLink : {}), position:"relative"}}>
              Cart {totalItems > 0 && <span style={s.badge}>{totalItems}</span>}
            </Link>
            <Link to="/checkouts" style={{...s.link, ...(active("/checkouts") ? s.activeLink : {})}}>My Checkouts</Link>
            {user.role === "admin" && (
              <>
                <span style={s.sep} />
                <Link to="/admin"     style={{...s.link, ...(active("/admin")     ? s.activeLink : {})}}>Admin</Link>
                <Link to="/dashboard" style={{...s.link, ...(active("/dashboard") ? s.activeLink : {})}}>Dashboard</Link>
              </>
            )}
          </nav>
        )}

        <div style={s.right}>
          {user ? (
            <>
              <span style={s.email}>{user.email}</span>
              <button onClick={handleLogout} style={s.logoutBtn}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login"    style={s.link}>Sign in</Link>
              <Link to="/register" style={s.registerBtn}>Register</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

const s = {
  header:     { position:"sticky", top:0, zIndex:100,
                background:"#1e3a8a",
                boxShadow:"0 2px 12px rgba(0,0,0,.28)" },
  inner:      { maxWidth:1260, margin:"0 auto", padding:"0 1.5rem",
                height:56, display:"flex", alignItems:"center", gap:"1.5rem" },
  brand:      { display:"flex", alignItems:"center", gap:"0.5rem",
                fontWeight:700, fontSize:"1rem", color:"#fff",
                textDecoration:"none", flexShrink:0 },
  nav:        { display:"flex", alignItems:"center", gap:"0.1rem", flex:1 },
  link:       { color:"rgba(255,255,255,.78)", textDecoration:"none",
                fontSize:"0.875rem", fontWeight:500,
                padding:"0.38rem 0.7rem", borderRadius:6,
                transition:"background .15s, color .15s" },
  activeLink: { color:"#fff", background:"rgba(255,255,255,.16)" },
  sep:        { width:1, height:18, background:"rgba(255,255,255,.2)", margin:"0 0.25rem" },
  right:      { display:"flex", alignItems:"center", gap:"0.75rem", marginLeft:"auto", flexShrink:0 },
  email:      { fontSize:"0.78rem", color:"rgba(255,255,255,.52)",
                maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  logoutBtn:  { padding:"0.32rem 0.8rem",
                background:"rgba(255,255,255,.1)",
                border:"1px solid rgba(255,255,255,.2)",
                borderRadius:6, color:"rgba(255,255,255,.85)",
                cursor:"pointer", fontSize:"0.82rem", fontWeight:500 },
  registerBtn:{ padding:"0.32rem 0.8rem", background:"#2563eb",
                border:"none", borderRadius:6, color:"#fff",
                cursor:"pointer", fontSize:"0.875rem", fontWeight:600,
                textDecoration:"none" },
  badge:      { position:"absolute", top:-5, right:-7,
                background:"#ef4444", color:"#fff",
                borderRadius:99, minWidth:17, height:17,
                display:"inline-flex", alignItems:"center", justifyContent:"center",
                fontSize:"0.68rem", fontWeight:700, padding:"0 3px" },
};
