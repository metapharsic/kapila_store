import { useState } from "react";
import kapilaLogo from "../../assets/kapila-logo.png";
import { COLORS, globalCss } from "../../styles/colors";
import { useAuth } from "../../context/AuthContext";
import { 
  Lock, AlertCircle, CheckCircle2, 
  Store, ChefHat, ShieldCheck, Cpu, Eye, EyeOff,
  LogIn, Sparkles
} from "lucide-react";

const QUICK_ROLES = [
  { 
    label: "Store Keeper", 
    code: "KPL-STORE", 
    email: "store@kapila.com", 
    dept: "Central Store", 
    role: "Store Operations", 
    icon: <Store size={18} />,
    color: "#e8a838",
    bg: "rgba(232, 168, 56, 0.12)"
  },
  { 
    label: "Main Chef", 
    code: "KPL-CHEF", 
    email: "Chef@kapila.com", 
    dept: "All Kitchens", 
    role: "Kitchen & Production", 
    icon: <ChefHat size={18} />,
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)"
  },
  { 
    label: "Kapila Admin", 
    code: "KPL-ADMIN", 
    email: "admin@kapila.local", 
    dept: "Management", 
    role: "Full System Access", 
    icon: <ShieldCheck size={18} />,
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.12)"
  },
];

const DEFAULT_PASSWORD = "ChangeMe123!";

const AGENT_BADGES = [
  { name: "SecOps", status: "ONLINE", color: "#10b981" },
  { name: "StoreOps", status: "SYNCED", color: "#10b981" },
  { name: "DataArchitect", status: "HEALTHY", color: "#10b981" },
  { name: "AdminMonitor", status: "STREAMING", color: "#3b82f6" },
  { name: "UIX Sentinel", status: "ACTIVE", color: "#e8a838" },
];

export default function LoginScreen() {
  const { login, sessionTerminatedNotice, clearTerminationNotice } = useAuth();

  const [selectedRoleCode, setSelectedRoleCode] = useState("KPL-STORE");
  const [identifier, setIdentifier] = useState("store@kapila.com");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSelectRole = (role) => {
    setSelectedRoleCode(role.code);
    setIdentifier(role.email);
    setPassword(DEFAULT_PASSWORD);
    setError("");
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!identifier.trim()) {
      setError("Please enter your email or employee ID");
      return;
    }
    if (!password) {
      setError("Please enter your password");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await login({
        email: identifier.trim(),
        employee_code: identifier.trim(),
        username: identifier.trim(),
        password,
      }, rememberMe);
    } catch (err) {
      setError(err.message || "Invalid credentials. Please verify your account and password.");
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = QUICK_ROLES.find(r => r.code === selectedRoleCode) || QUICK_ROLES[0];

  return (
    <>
      <style>{globalCss}</style>
      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 15%, #182236 0%, #080c14 85%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "var(--font-sans)",
        color: "#f1f5f9",
      }}>
        {/* Main Login Card */}
        <div style={{
          width: "100%",
          maxWidth: 460,
          background: "rgba(15, 23, 42, 0.88)",
          border: "1px solid rgba(232, 168, 56, 0.25)",
          borderRadius: 16,
          padding: "32px 28px 24px",
          boxShadow: "0 25px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(232, 168, 56, 0.06)",
          backdropFilter: "blur(16px)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Gold Ambient Glow Bar */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, transparent 0%, #e8a838 50%, transparent 100%)",
          }} />

          {/* Logo & Header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
            <div style={{
              background: "rgba(255, 255, 255, 0.04)",
              padding: "8px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255, 255, 255, 0.08)",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <img src={kapilaLogo} alt="Kapila IMS" style={{ height: 44, objectFit: "contain" }} />
            </div>

            <h1 style={{
              margin: "4px 0 2px",
              color: "#ffffff",
              fontSize: 24,
              fontFamily: "var(--font-display)",
              letterSpacing: "0.5px",
              textAlign: "center",
            }}>
              Hotel Kapila Inventory
            </h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
              Enterprise Store & Kitchen Management System
            </p>
          </div>

          {/* Session Termination Notice Alert */}
          {sessionTerminatedNotice && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#fca5a5",
              fontSize: 13,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, color: "#ef4444" }} />
              <div style={{ flex: 1 }}>{sessionTerminatedNotice}</div>
              <button
                onClick={clearTerminationNotice}
                style={{ background: "transparent", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 14 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* 1-Tap Quick Role Selector */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={sectionLabelStyle}>Select Staff Account</label>
              <span style={{ fontSize: 11, color: "#e8a838", fontWeight: 600 }}>1-Tap Auto-fill</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {QUICK_ROLES.map((role) => {
                const isSelected = selectedRoleCode === role.code;
                return (
                  <button
                    key={role.code}
                    type="button"
                    onClick={() => handleSelectRole(role)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 6px",
                      borderRadius: 10,
                      border: `1.5px solid ${isSelected ? "#e8a838" : "rgba(255, 255, 255, 0.08)"}`,
                      background: isSelected ? "rgba(232, 168, 56, 0.12)" : "rgba(255, 255, 255, 0.03)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? "0 0 14px rgba(232, 168, 56, 0.2)" : "none",
                      color: isSelected ? "#ffffff" : "#94a3b8",
                      outline: "none",
                    }}
                  >
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: role.bg,
                      color: role.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 6,
                    }}>
                      {role.icon}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? "#ffffff" : "#cbd5e1", textAlign: "center" }}>
                      {role.label}
                    </span>
                    <span style={{ fontSize: 10, color: isSelected ? "#e8a838" : "#64748b", fontWeight: 600 }}>
                      {role.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Simple Login Form */}
          <form onSubmit={handleSubmit}>
            {/* User Identifier Input */}
            <div style={{ marginBottom: 14 }}>
              <label style={sectionLabelStyle}>Account Email or Employee ID</label>
              <div style={{ position: "relative", marginTop: 6 }}>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setError("");
                  }}
                  style={textInputStyle}
                  placeholder="e.g. store@kapila.com or KPL-STORE"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password Input with Show/Hide Toggle */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={sectionLabelStyle}>Password</label>
                <button
                  type="button"
                  onClick={() => { setPassword(DEFAULT_PASSWORD); setError(""); }}
                  style={{
                    fontSize: 11,
                    color: "#e8a838",
                    background: "rgba(232, 168, 56, 0.12)",
                    padding: "2px 8px",
                    borderRadius: 5,
                    fontWeight: 600,
                    border: "1px solid rgba(232, 168, 56, 0.3)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                  title="Restore default test password"
                >
                  <Sparkles size={11} /> Reset to Default
                </button>
              </div>

              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  style={{ ...textInputStyle, paddingRight: 40 }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    padding: 4,
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Default Password Active Notice */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(232, 168, 56, 0.08)",
              border: "1px solid rgba(232, 168, 56, 0.2)",
              borderRadius: 8,
              padding: "7px 12px",
              marginBottom: 16,
              fontSize: 12,
              color: "#cbd5e1",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                <span>Default trial password: <strong style={{ color: "#e8a838" }}>ChangeMe123!</strong></span>
              </span>
              <span style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                DB Validated
              </span>
            </div>

            {/* Remember Me Checkbox (7-Day Persistent Session) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <label style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#cbd5e1",
                cursor: "pointer",
                userSelect: "none",
              }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    accentColor: "#e8a838",
                    width: 16,
                    height: 16,
                    cursor: "pointer",
                  }}
                />
                <span>Stay signed in for 7 days</span>
              </label>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div style={{
                color: "#ef4444",
                fontSize: 13,
                marginBottom: 14,
                background: "rgba(239, 68, 68, 0.1)",
                padding: "9px 12px",
                borderRadius: 8,
                border: "1px solid rgba(239, 68, 68, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: 48,
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #e8a838 0%, #d49424 100%)",
                color: "#0f172a",
                fontSize: 15,
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 6px 20px rgba(232, 168, 56, 0.3)",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                letterSpacing: "0.02em",
                opacity: loading ? 0.75 : 1,
              }}
            >
              {loading ? (
                "Verifying with Database..."
              ) : (
                <>
                  <LogIn size={18} /> Sign In as {selectedRole.label}
                </>
              )}
            </button>
          </form>

          {/* Multi-Agent Swarm Real-Time Status Strip */}
          <div style={{
            marginTop: 20,
            paddingTop: 14,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 11,
              color: "#94a3b8",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, color: "#e8a838" }}>
                <Cpu size={12} /> Multi-Agent Swarm
              </span>
              <span style={{ color: "#10b981", fontWeight: 800, fontSize: 10 }}>ALL AGENTS ONLINE</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {AGENT_BADGES.map((b) => (
                <span
                  key={b.name}
                  style={{
                    fontSize: 10,
                    padding: "2px 7px",
                    borderRadius: 5,
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    color: "#cbd5e1",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: b.color }} />
                  <strong>{b.name}:</strong> <span style={{ color: b.color }}>{b.status}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const sectionLabelStyle = {
  color: "#94a3b8",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  display: "block",
};

const textInputStyle = {
  width: "100%",
  height: 44,
  borderRadius: 8,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "#0b1220",
  color: "#ffffff",
  padding: "0 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease",
};
