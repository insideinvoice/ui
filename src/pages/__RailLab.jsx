import { AuthContext } from "../context/AuthContext";
import AppNavbar from "../components/AppNavbar";

// TEMPORARY dev bench for the sidebar animation (scripts/__railshot.mjs).
// Route registered in App.jsx only in DEV. Delete after use.
// NOTE: no inline background on the shell — the real app-shell is transparent
// over the body (#f8fafc), and the open-slide strip must match that.
export default function RailLab() {
  return (
    <AuthContext.Provider
      value={{ logout: () => {}, isAdmin: true, documentAccess: {} }}
    >
      <AppNavbar />
      <div className="app-shell" style={{ minHeight: "100vh", padding: 24 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 900 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>Welcome</h1>
          <p style={{ color: "#64748b", marginTop: 4 }}>
            ChatGPT-grade rail bench — content edge must track the panel every frame.
          </p>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{ height: 90, marginTop: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10 }}
            />
          ))}
        </div>
      </div>
    </AuthContext.Provider>
  );
}
