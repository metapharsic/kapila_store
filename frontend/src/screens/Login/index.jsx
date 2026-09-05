import { useState, useEffect } from "react";
import kapilaLogo from "../../assets/kapila-logo.png";
import { COLORS, globalCss } from "../../styles/colors";
import { useAuth } from "../../context/AuthContext";
import { 
  Shield, KeyRound, UserCheck, Clock, Monitor, Lock, 
  AlertCircle, Sparkles, CheckCircle2, Delete, RotateCcw,
  Store, ChefHat, ShieldCheck, Cpu
} from "lucide-react";

const QUICK_USERS = [
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
    label: "General Admin", 
    code: "KPL-ADMIN", 
    email: "admin@kapila.local", 
    dept: "Management", 
    role: "Full System Access", 
    icon: <ShieldCheck size={18} />,
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.12)"
  },
];

const AGENT_BADGES = [
  { name: "SecOps", status: "ONLINE", color: "#10b981" },
  { name: "StoreOps", status: "SYNCED", color: "#10b981" },
  { name: "AdminMonitor", status: "STREAMING", color: "#3b82f6" },
  { name: "DataArchitect", status: "HEALTHY", color: "#10b981" },
  { name: "UIX Sentinel", status: "ACTIVE", color: "#e8a838" },
];

export default function LoginScreen() {
  const { login, sessionTerminatedNotice, clearTerminationNotice } = useAuth();
  const [activeTab, setActiveTab] = useState("kiosk"); // 'kiosk' | 'admin'

  // Admin / Email mode
  const [email, setEmail] = useState("admin@kapila.local");
  const [password, setPassword] = useState("");

  // Kiosk / Store Mode
  const [selectedUserCode, setSelectedUserCode] = useState("KPL-STORE");
  const [pin, setPin] = useState("");
  const [shiftType, setShiftType] = useState("Morning");
  const [terminalCode, setTerminalCode] = useState("STORE-MAIN-TAB-01");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) setShiftType("Morning");
    else if (hour >= 14 && hour < 22) setShiftType("Evening");
    else setShiftType("Night");
  }, []);

  const handleAdminSubmit = async (e) => {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleKioskSubmit = async (e) => {
    e?.preventDefault();
    if (!pin || pin.length < 4) {
      setError("Please enter your 4-digit security PIN (Default: 1234)");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login({
        employee_code: selectedUserCode,
        pin: pin.trim(),
        shift_type: shiftType,
        terminal_code: terminalCode,
      });
    } catch (err) {
      setError(err.message || "Invalid PIN. Default Store PIN is 1234");
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadPress = (digit) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setError("");
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleClear = () => {
    setPin("");
    setError("");
  };

  const selectedUser = QUICK_USERS.find(u => u.code === selectedUserCode) || QUICK_USERS[0];

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
        {/* Main Card Container */}
        <div style={{
          width: "100%",
          maxWidth: 480,
          background: "rgba(15, 23, 42, 0.88)",
          border: "1px solid rgba(232, 168, 56, 0.25)",
          borderRadius: 16,
          padding: "32px 28px",
          boxShadow: "0 25px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(232, 168, 56, 0.06)",
          backdropFilter: "blur(16px)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Subtle Gold Ambient Glow Bar */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, transparent 0%, #e8a838 50%, transparent 100%)",
          }} />

          {/* Logo & Luxury Header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
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
              <img src={kapilaLogo} alt="Kapila IMS" style={{ height: 42, objectFit: "contain" }} />
            </div>

            <h1 style={{
              margin: "6px 0 2px",
              color: "#ffffff",
              fontSize: 26,
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
              padding: "12px 14px",
              marginBottom: 18,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              color: "#fca5a5",
              fontSize: 13,
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2, color: "#ef4444" }} />
              <div style={{ flex: 1 }}>
                <strong style={{ color: "#ffffff" }}>Security Notice:</strong> {sessionTerminatedNotice}
              </div>
              <button
                onClick={clearTerminationNotice}
                style={{ background: "transparent", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 16 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Mode Switch Tabs */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            background: "rgba(0, 0, 0, 0.35)",
            borderRadius: 10,
            padding: 4,
            marginBottom: 20,
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}>
            <button
              type="button"
              onClick={() => { setActiveTab("kiosk"); setError(""); }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
                background: activeTab === "kiosk" ? "linear-gradient(135deg, #e8a838 0%, #d49424 100%)" : "transparent",
                color: activeTab === "kiosk" ? "#0f172a" : "#94a3b8",
                boxShadow: activeTab === "kiosk" ? "0 4px 12px rgba(232, 168, 56, 0.3)" : "none",
              }}
            >
              <KeyRound size={16} /> Store Kiosk (PIN)
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("admin"); setError(""); }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s",
                background: activeTab === "admin" ? "linear-gradient(135deg, #e8a838 0%, #d49424 100%)" : "transparent",
                color: activeTab === "admin" ? "#0f172a" : "#94a3b8",
                boxShadow: activeTab === "admin" ? "0 4px 12px rgba(232, 168, 56, 0.3)" : "none",
              }}
            >
              <Shield size={16} /> Management Sign In
            </button>
          </div>

          {/* KIOSK / STORE OPERATIONS LOGIN MODE */}
          {activeTab === "kiosk" ? (
            <div>
              {/* Step 1: Select Staff Role */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={sectionLabelStyle}>1. Select On-Duty Staff Account</label>
                  <span style={{ fontSize: 11, color: "#e8a838", fontWeight: 700 }}>Tap below</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                  {QUICK_USERS.map((u) => {
                    const isSelected = selectedUserCode === u.code;
                    return (
                      <div
                        key={u.code}
                        onClick={() => { setSelectedUserCode(u.code); setError(""); }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: `1.5px solid ${isSelected ? "#e8a838" : "rgba(255, 255, 255, 0.08)"}`,
                          background: isSelected ? "rgba(232, 168, 56, 0.12)" : "rgba(255, 255, 255, 0.03)",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          boxShadow: isSelected ? "0 0 16px rgba(232, 168, 56, 0.15)" : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            background: u.bg,
                            color: u.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: `1px solid ${isSelected ? "#e8a838" : "rgba(255, 255, 255, 0.1)"}`,
                          }}>
                            {u.icon}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: isSelected ? "#ffffff" : "#cbd5e1" }}>
                              {u.label} <span style={{ fontSize: 12, color: isSelected ? "#e8a838" : "#64748b", fontWeight: 600 }}>({u.code})</span>
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>{u.dept} • {u.role}</div>
                          </div>
                        </div>

                        {isSelected ? (
                          <CheckCircle2 size={20} color="#e8a838" />
                        ) : (
                          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Select</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Shift & Terminal Selector */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div>
                  <label style={sectionLabelStyle}><Clock size={12} style={{ verticalAlign: -1 }} /> Shift</label>
                  <select
                    value={shiftType}
                    onChange={(e) => setShiftType(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="Morning">Morning Shift</option>
                    <option value="Evening">Evening Shift</option>
                    <option value="Night">Night Shift</option>
                  </select>
                </div>
                <div>
                  <label style={sectionLabelStyle}><Monitor size={12} style={{ verticalAlign: -1 }} /> Terminal</label>
                  <select
                    value={terminalCode}
                    onChange={(e) => setTerminalCode(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="STORE-MAIN-TAB-01">Store Room Tab 1</option>
                    <option value="STORE-BACK-PC-02">Store Room PC 2</option>
                    <option value="KITCHEN-TAB-01">Main Kitchen Tab</option>
                  </select>
                </div>
              </div>

              {/* PIN Code Display & Help Hint */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                  <label style={sectionLabelStyle}>2. Enter 4-Digit Security PIN</label>
                  <button
                    type="button"
                    onClick={() => { setPin("1234"); setError(""); }}
                    style={{
                      fontSize: 11,
                      color: "#e8a838",
                      background: "rgba(232, 168, 56, 0.14)",
                      padding: "3px 9px",
                      borderRadius: 6,
                      fontWeight: 700,
                      border: "1px solid rgba(232, 168, 56, 0.3)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      transition: "all 0.15s ease",
                    }}
                    title="Click to auto-fill default PIN"
                  >
                    💡 Default PIN: 1234 for Store Manager (Tap to fill)
                  </button>
                </div>

                {/* Visual PIN Dots / Box */}
                <div
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (/^[0-9]$/.test(e.key)) {
                      handleKeypadPress(e.key);
                    } else if (e.key === "Backspace") {
                      handleBackspace();
                    } else if (e.key === "Enter") {
                      handleKioskSubmit();
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "rgba(0, 0, 0, 0.4)",
                    borderRadius: 12,
                    border: "1px solid rgba(232, 168, 56, 0.3)",
                    marginBottom: 12,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {[0, 1, 2, 3].map((idx) => {
                    const hasDigit = pin.length > idx;
                    return (
                      <div
                        key={idx}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: hasDigit ? "#e8a838" : "rgba(255, 255, 255, 0.15)",
                          boxShadow: hasDigit ? "0 0 10px rgba(232, 168, 56, 0.6)" : "none",
                          transition: "all 0.15s ease",
                        }}
                      />
                    );
                  })}
                </div>

                {/* Touchscreen Kiosk Keypad */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  marginBottom: 14,
                }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleKeypadPress(String(n))}
                      style={keypadButtonStyle}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    style={{ ...keypadButtonStyle, color: "#94a3b8", fontSize: 13 }}
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress("0")}
                    style={keypadButtonStyle}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    style={{ ...keypadButtonStyle, color: "#fca5a5" }}
                  >
                    <Delete size={18} />
                  </button>
                </div>
              </div>

              {error && (
                <div style={{
                  color: "#ef4444",
                  fontSize: 13,
                  marginBottom: 12,
                  background: "rgba(239, 68, 68, 0.1)",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                }}>
                  {error}
                </div>
              )}

              {/* Submit Action Button */}
              <button
                type="button"
                onClick={handleKioskSubmit}
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
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  letterSpacing: "0.02em",
                }}
              >
                {loading ? (
                  "Authenticating Storekeeper..."
                ) : (
                  <>
                    <KeyRound size={18} /> Open {selectedUser.label} Session
                  </>
                )}
              </button>
            </div>
          ) : (
            /* MANAGEMENT / OFFICE EMAIL LOGIN MODE */
            <form onSubmit={handleAdminSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={sectionLabelStyle}>Management Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={textInputStyle}
                  autoComplete="email"
                  placeholder="admin@kapila.local"
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                  <label style={sectionLabelStyle}>Password</label>
                  <button
                    type="button"
                    onClick={() => { setPassword("ChangeMe123!"); setError(""); }}
                    style={{
                      fontSize: 11,
                      color: "#e8a838",
                      background: "rgba(232, 168, 56, 0.14)",
                      padding: "3px 9px",
                      borderRadius: 6,
                      fontWeight: 700,
                      border: "1px solid rgba(232, 168, 56, 0.3)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                    title="Click to auto-fill default password"
                  >
                    💡 Default: ChangeMe123! (Tap to fill)
                  </button>
                </div>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  style={textInputStyle}
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div style={{
                  color: "#ef4444",
                  fontSize: 13,
                  marginBottom: 12,
                  background: "rgba(239, 68, 68, 0.1)",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                }}>
                  {error}
                </div>
              )}

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
                  transition: "all 0.2s",
                }}
              >
                {loading ? "Signing in..." : "Sign in to Management Console"}
              </button>
            </form>
          )}

          {/* Multi-Agent Swarm Real-Time Footer */}
          <div style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 11,
              color: "#94a3b8",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 700, color: "#e8a838" }}>
                <Cpu size={13} /> Multi-Agent Swarm Status
              </span>
              <span style={{ color: "#10b981", fontWeight: 800 }}>ALL AGENTS ACTIVE</span>
            </div>

            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}>
              {AGENT_BADGES.map((b) => (
                <span
                  key={b.name}
                  style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 6,
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

const selectStyle = {
  width: "100%",
  height: 40,
  marginTop: 6,
  borderRadius: 8,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "#0f172a",
  color: "#ffffff",
  padding: "0 10px",
  fontSize: 13,
  fontWeight: 600,
  outline: "none",
};

const textInputStyle = {
  width: "100%",
  height: 44,
  marginTop: 6,
  borderRadius: 8,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "#0f172a",
  color: "#ffffff",
  padding: "0 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const keypadButtonStyle = {
  height: 44,
  borderRadius: 8,
  border: "1px solid rgba(255, 255, 255, 0.08)",
  background: "rgba(255, 255, 255, 0.04)",
  color: "#ffffff",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.1s ease",
  userSelect: "none",
};
