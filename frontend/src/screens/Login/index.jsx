import { useState, useEffect } from "react";
import kapilaLogo from "../../assets/kapila-logo.png";
import { COLORS, globalCss } from "../../styles/colors";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../api";
import { 
  Lock, AlertCircle, CheckCircle2, 
  Store, ChefHat, ShieldCheck, Cpu, Eye, EyeOff,
  LogIn, Sparkles, Smartphone, Tablet, Monitor,
  RotateCcw, Delete, Zap, Shield, ArrowRight, Building2
} from "lucide-react";

function renderStationIcon(iconKey) {
  switch (iconKey) {
    case "ChefHat": return <ChefHat size={22} />;
    case "Store": return <Store size={22} />;
    case "ShieldCheck": return <ShieldCheck size={22} />;
    case "Building2": return <Building2 size={22} />;
    default: return <Cpu size={22} />;
  }
}

const DEFAULT_QUICK_ROLES = [
  { 
    label: "Main Chef", 
    code: "KPL-CHEF", 
    email: "Chef@kapila.com", 
    dept: "All Kitchens", 
    role: "Kitchen & Production", 
    routeHint: "Direct to Kitchen Station",
    icon: "ChefHat",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.14)",
    border: "rgba(16, 185, 129, 0.4)",
    glow: "rgba(16, 185, 129, 0.25)"
  },
  { 
    label: "Store Keeper", 
    code: "KPL-STORE", 
    email: "store@kapila.com", 
    dept: "Central Store", 
    role: "Store Operations", 
    routeHint: "Direct to Store Manager Hub",
    icon: "Store",
    color: "#e8a838",
    bg: "rgba(232, 168, 56, 0.14)",
    border: "rgba(232, 168, 56, 0.4)",
    glow: "rgba(232, 168, 56, 0.25)"
  },
  { 
    label: "Kapila Admin", 
    code: "KPL-ADMIN", 
    email: "admin@kapila.local", 
    dept: "Executive Office", 
    role: "Full System Access", 
    routeHint: "Direct to Master Dashboard",
    icon: "ShieldCheck",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.14)",
    border: "rgba(59, 130, 246, 0.4)",
    glow: "rgba(59, 130, 246, 0.25)"
  },
];

export default function LoginScreen() {
  const { login, sessionTerminatedNotice, clearTerminationNotice } = useAuth();

  // Dynamic stations & shifts state (loaded from PostgreSQL database)
  const [stations, setStations] = useState(DEFAULT_QUICK_ROLES);
  const [shifts, setShifts] = useState([]);
  const [selectedShift, setSelectedShift] = useState("Morning");
  const [terminalCode, setTerminalCode] = useState("STORE-KIOSK-01");

  // Station memory: check if device has saved station
  const savedStation = typeof window !== "undefined" ? localStorage.getItem("kapila_device_station") : null;
  const initialRole = stations.find(r => r.code === savedStation) || stations[0];

  const [selectedRoleCode, setSelectedRoleCode] = useState(initialRole.code);
  const [activeTab, setActiveTab] = useState("touch"); // 'touch' (Touch Station & PIN) | 'form' (Credentials)
  
  // Credentials state
  const [identifier, setIdentifier] = useState(initialRole.email || initialRole.code);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Touchpad PIN Pad state
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Load dynamic stations and shifts from database via multi-thread backend
  useEffect(() => {
    let isMounted = true;
    api.auth.stations()
      .then(res => {
        if (!isMounted) return;
        const d = res.data;
        if (d?.stations && d.stations.length > 0) {
          setStations(d.stations);
          const saved = localStorage.getItem("kapila_device_station");
          const found = d.stations.find(s => s.code === saved) || d.stations[0];
          setSelectedRoleCode(found.code);
          setIdentifier(found.email || found.code);
        }
        if (d?.shifts && d.shifts.length > 0) {
          setShifts(d.shifts);
          setSelectedShift(d.shifts[0].name);
        }
        if (d?.defaultTerminal) {
          setTerminalCode(d.defaultTerminal);
        }
      })
      .catch(err => {
        console.warn("Could not fetch database stations, running on default presets:", err.message);
      });
    return () => { isMounted = false; };
  }, []);

  // Device telemetry detection (Mobile / Touchpad / Desktop)
  const [deviceProfile, setDeviceProfile] = useState({
    type: "desktop",
    label: "Desktop Workstation",
    icon: <Monitor size={12} />,
    isTouch: false
  });

  useEffect(() => {
    const updateDevice = () => {
      const w = window.innerWidth;
      const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
      if (w <= 540) {
        setDeviceProfile({
          type: "mobile",
          label: "Mobile Handheld View",
          icon: <Smartphone size={12} />,
          isTouch
        });
      } else if (w <= 1024) {
        setDeviceProfile({
          type: "touchpad",
          label: "Touchpad / Tablet KDS",
          icon: <Tablet size={12} />,
          isTouch
        });
      } else {
        setDeviceProfile({
          type: "desktop",
          label: isTouch ? "Touchscreen POS" : "Desktop Workstation",
          icon: <Monitor size={12} />,
          isTouch
        });
      }
    };
    updateDevice();
    window.addEventListener("resize", updateDevice);
    return () => window.removeEventListener("resize", updateDevice);
  }, []);

  const handleSelectRole = (role) => {
    setSelectedRoleCode(role.code);
    setIdentifier(role.email || role.code);
    setPin("");
    setError("");
    setPinError("");
    try {
      localStorage.setItem("kapila_device_station", role.code);
    } catch (e) {}
  };

  // Perform standard password login
  const executeLogin = async (id, pwd) => {
    setError("");
    setPinError("");
    setLoading(true);
    try {
      await login({
        email: id.trim(),
        employee_code: id.trim(),
        username: id.trim(),
        password: pwd,
        terminal_code: terminalCode || "STORE-KIOSK-01",
        shift_type: selectedShift || "Morning",
      }, rememberMe);
    } catch (err) {
      const msg = err.message || "Invalid credentials. Please verify your account and password.";
      setError(msg);
      setPinError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Perform genuine database-backed PIN authentication
  const executePinLogin = async (targetStation, enteredPin) => {
    setError("");
    setPinError("");
    setLoading(true);
    try {
      await login({
        employee_code: targetStation.code,
        email: targetStation.email,
        pin: enteredPin,
        terminal_code: terminalCode || "STORE-KIOSK-01",
        shift_type: selectedShift || "Morning",
      }, rememberMe);
    } catch (err) {
      const msg = err.message || "Invalid Station PIN. Please verify your 4-digit PIN.";
      setPinError(msg);
      setError(msg);
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  // Form submit handler
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
    await executeLogin(identifier, password);
  };

  // Touchpad PIN keypad tap
  const handlePinPress = (num) => {
    if (loading) return;
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setPinError("");
      if (nextPin.length === 4) {
        // Auto authenticate with database-stored PIN
        const currentStation = stations.find(r => r.code === selectedRoleCode) || stations[0];
        executePinLogin(currentStation, nextPin);
      }
    }
  };

  const handlePinBackspace = () => {
    if (loading) return;
    setPin(prev => prev.slice(0, -1));
    setPinError("");
  };

  const handlePinClear = () => {
    if (loading) return;
    setPin("");
    setPinError("");
  };

  // Instant 1-Tap Clock-in
  const handleQuickClockIn = () => {
    const currentStation = stations.find(r => r.code === selectedRoleCode) || stations[0];
    if (pin.length === 4) {
      executePinLogin(currentStation, pin);
    } else {
      setPinError("Please enter your 4-digit PIN on the numeric keypad below");
    }
  };

  const selectedRole = stations.find(r => r.code === selectedRoleCode) || stations[0] || DEFAULT_QUICK_ROLES[0];

  return (
    <>
      <style>{globalCss}</style>
      <style>{`
        .kapila-login-container {
          min-height: 100vh;
          background: radial-gradient(ellipse at 50% 12%, #1a2538 0%, #080c14 85%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justifyContent: center;
          padding: 16px;
          font-family: var(--font-sans);
          color: #f1f5f9;
          box-sizing: border-box;
        }
        .login-card {
          width: 100%;
          max-width: 520px;
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(232, 168, 56, 0.28);
          border-radius: 20px;
          padding: 28px 24px 20px;
          box-shadow: 0 25px 80px rgba(0, 0, 0, 0.75), 0 0 50px rgba(232, 168, 56, 0.08);
          backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
          transition: all 0.25s ease;
        }
        .station-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .station-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justifyContent: center;
          min-height: 86px;
          padding: 12px 8px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          outline: none;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .station-btn:active {
          transform: scale(0.96);
        }
        .pin-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          max-width: 320px;
          margin: 0 auto;
        }
        .pin-btn {
          height: 56px;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.10);
          background: rgba(255, 255, 255, 0.04);
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.12s ease;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        .pin-btn:active {
          background: rgba(232, 168, 56, 0.25);
          border-color: #e8a838;
          transform: scale(0.94);
        }
        .pin-btn.action-btn {
          font-size: 14px;
          font-weight: 600;
          color: #94a3b8;
        }
        /* Mobile Viewport Optimizations */
        @media (max-width: 540px) {
          .kapila-login-container {
            padding: 12px 8px;
            justify-content: flex-start;
          }
          .login-card {
            padding: 20px 16px 16px;
            border-radius: 16px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.8);
          }
          .station-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .station-btn {
            flex-direction: row;
            justify-content: flex-start;
            min-height: 58px;
            padding: 10px 14px;
            gap: 12px;
          }
          .station-btn-text {
            text-align: left !important;
          }
          .pin-grid {
            max-width: 100%;
            gap: 8px;
          }
          .pin-btn {
            height: 50px;
            font-size: 20px;
          }
        }
        /* Touchpad & Tablet Viewport Optimizations */
        @media (min-width: 541px) and (max-width: 1024px) {
          .login-card {
            max-width: 600px;
            padding: 32px 30px 24px;
          }
          .station-btn {
            min-height: 96px;
          }
          .pin-grid {
            max-width: 360px;
            gap: 12px;
          }
          .pin-btn {
            height: 60px;
            font-size: 24px;
          }
        }
      `}</style>

      <div className="kapila-login-container">
        {/* Main Login Card */}
        <div className="login-card">
          {/* Gold & Emerald Ambient Indicator Bar */}
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: selectedRole.code === "KPL-CHEF"
              ? "linear-gradient(90deg, transparent 0%, #10b981 50%, transparent 100%)"
              : selectedRole.code === "KPL-STORE"
              ? "linear-gradient(90deg, transparent 0%, #e8a838 50%, transparent 100%)"
              : "linear-gradient(90deg, transparent 0%, #3b82f6 50%, transparent 100%)",
            transition: "background 0.3s ease"
          }} />

          {/* Header & Logo */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 18 }}>
            <div style={{
              background: "rgba(255, 255, 255, 0.04)",
              padding: "6px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255, 255, 255, 0.08)",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <img src={kapilaLogo} alt="Kapila IMS" style={{ height: 38, objectFit: "contain" }} />
            </div>

            <h1 style={{
              margin: "2px 0 2px",
              color: "#ffffff",
              fontSize: 22,
              fontFamily: "var(--font-display)",
              letterSpacing: "0.5px",
              textAlign: "center",
            }}>
              Hotel Kapila Inventory
            </h1>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, textAlign: "center" }}>
              Mobile & Touchpad Unified Station Terminal
            </p>

            {/* Device Profile Badge */}
            <div style={{
              marginTop: 6,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 20,
              padding: "3px 10px",
              fontSize: 10,
              color: "#38bdf8",
              fontWeight: 600,
              letterSpacing: "0.02em"
            }}>
              {deviceProfile.icon}
              <span>{deviceProfile.label}</span>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#10b981" }} />
              <span style={{ color: "#10b981" }}>Touchpad Ready</span>
            </div>
          </div>

          {/* Session Termination Notice */}
          {sessionTerminatedNotice && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: 10,
              padding: "9px 12px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#fca5a5",
              fontSize: 12,
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, color: "#ef4444" }} />
              <div style={{ flex: 1 }}>{sessionTerminatedNotice}</div>
              <button
                onClick={clearTerminationNotice}
                style={{ background: "transparent", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 13 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Station Selector Cards (Chef, Store, Admin) */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={sectionLabelStyle}>Select Operating Station</label>
              <span style={{ fontSize: 11, color: selectedRole.color, fontWeight: 700, transition: "color 0.2s" }}>
                ● {selectedRole.label} Active
              </span>
            </div>

            <div className="station-grid">
              {stations.map((role) => {
                const isSelected = selectedRoleCode === role.code;
                const iconEl = typeof role.icon === "string" ? renderStationIcon(role.icon) : (role.icon || renderStationIcon(role.iconKey));
                return (
                  <button
                    key={role.code}
                    type="button"
                    className="station-btn"
                    onClick={() => handleSelectRole(role)}
                    style={{
                      border: `1.5px solid ${isSelected ? role.color : "rgba(255, 255, 255, 0.08)"}`,
                      background: isSelected ? role.bg : "rgba(255, 255, 255, 0.02)",
                      boxShadow: isSelected ? `0 0 20px ${role.glow}` : "none",
                      color: isSelected ? "#ffffff" : "#94a3b8",
                    }}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: isSelected ? role.color : "rgba(255, 255, 255, 0.06)",
                      color: isSelected ? "#080c14" : role.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 4,
                      flexShrink: 0,
                      transition: "all 0.2s ease"
                    }}>
                      {iconEl}
                    </div>
                    <div className="station-btn-text" style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "#ffffff" : "#cbd5e1" }}>
                        {role.label}
                      </div>
                      <div style={{ fontSize: 10, color: isSelected ? role.color : "#64748b", fontWeight: 600 }}>
                        {role.dept}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Operating Shift Selector (Fetched from shift_patterns) */}
            <div style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(0, 0, 0, 0.25)",
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255, 255, 255, 0.06)"
            }}>
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Operating Shift:
              </span>
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                style={{
                  background: "#0b1220",
                  color: "#ffffff",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 12,
                  fontWeight: 600,
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {shifts.length > 0 ? (
                  shifts.map((s) => (
                    <option key={s.id || s.name} value={s.name}>
                      {s.name} {s.start_time ? `(${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)})` : ""}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Morning">Morning Shift (06:00 - 14:00)</option>
                    <option value="Evening">Evening Shift (14:00 - 22:00)</option>
                    <option value="Night">Night Shift (22:00 - 06:00)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Mode Switcher Tabs: Touch Station (PIN) vs Standard Password */}
          <div style={{
            display: "flex",
            background: "rgba(0, 0, 0, 0.35)",
            padding: 3,
            borderRadius: 10,
            marginBottom: 16,
            border: "1px solid rgba(255, 255, 255, 0.08)"
          }}>
            <button
              type="button"
              onClick={() => setActiveTab("touch")}
              style={{
                flex: 1,
                height: 36,
                borderRadius: 8,
                border: "none",
                background: activeTab === "touch" ? selectedRole.color : "transparent",
                color: activeTab === "touch" ? "#080c14" : "#94a3b8",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s ease",
                touchAction: "manipulation"
              }}
            >
              <Zap size={14} /> Touch Station & PIN
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("form")}
              style={{
                flex: 1,
                height: 36,
                borderRadius: 8,
                border: "none",
                background: activeTab === "form" ? selectedRole.color : "transparent",
                color: activeTab === "form" ? "#080c14" : "#94a3b8",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s ease",
                touchAction: "manipulation"
              }}
            >
              <Lock size={14} /> Password Form
            </button>
          </div>

          {/* TAB 1: Touchpad & PIN Station */}
          {activeTab === "touch" && (
            <div>
              {/* Active Station Banner */}
              <div style={{
                background: selectedRole.bg,
                border: `1px solid ${selectedRole.border}`,
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: selectedRole.color,
                    color: "#080c14",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800
                  }}>
                    {selectedRole.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#ffffff" }}>
                      {selectedRole.label} ({selectedRole.code})
                    </div>
                    <div style={{ fontSize: 11, color: selectedRole.color, fontWeight: 600 }}>
                      {selectedRole.routeHint}
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#10b981",
                  background: "rgba(16, 185, 129, 0.15)",
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(16, 185, 129, 0.3)"
                }}>
                  SYNCED
                </span>
              </div>

              {/* Instant 1-Tap Clock-in Button */}
              <button
                type="button"
                onClick={handleQuickClockIn}
                disabled={loading}
                style={{
                  width: "100%",
                  height: 50,
                  borderRadius: 12,
                  border: "none",
                  background: selectedRole.code === "KPL-CHEF"
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : selectedRole.code === "KPL-STORE"
                    ? "linear-gradient(135deg, #e8a838 0%, #d49424 100%)"
                    : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  color: "#080c14",
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: `0 8px 24px ${selectedRole.glow}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 16,
                  transition: "all 0.18s ease",
                  touchAction: "manipulation",
                  opacity: loading ? 0.75 : 1
                }}
              >
                {loading ? (
                  "Authenticating Station..."
                ) : (
                  <>
                    <LogIn size={18} /> 1-Tap Clock-In as {selectedRole.label} <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* PIN Code Keypad (For Wall Touchpads & Quick Passcodes) */}
              <div style={{
                background: "rgba(0, 0, 0, 0.25)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: 16,
                padding: "14px 12px",
                marginBottom: 12
              }}>
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>
                    Or Enter 4-Digit Station PIN (Default: 1 2 3 4)
                  </div>
                  {/* PIN Dots Display */}
                  <div style={{ display: "flex", justifyContent: "center", gap: 12, height: 20, alignItems: "center" }}>
                    {[0, 1, 2, 3].map((idx) => {
                      const isFilled = pin.length > idx;
                      return (
                        <div
                          key={idx}
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            border: `2px solid ${isFilled ? selectedRole.color : "rgba(255, 255, 255, 0.2)"}`,
                            background: isFilled ? selectedRole.color : "transparent",
                            boxShadow: isFilled ? `0 0 10px ${selectedRole.color}` : "none",
                            transition: "all 0.15s ease"
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* PIN Error Message */}
                {pinError && (
                  <div style={{
                    color: "#ef4444",
                    fontSize: 11,
                    textAlign: "center",
                    marginBottom: 8
                  }}>
                    {pinError}
                  </div>
                )}

                {/* Numeric Touchpad Keypad */}
                <div className="pin-grid">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      className="pin-btn"
                      onClick={() => handlePinPress(String(digit))}
                    >
                      {digit}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="pin-btn action-btn"
                    onClick={handlePinClear}
                    title="Clear"
                  >
                    <RotateCcw size={16} />
                  </button>
                  <button
                    type="button"
                    className="pin-btn"
                    onClick={() => handlePinPress("0")}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="pin-btn action-btn"
                    onClick={handlePinBackspace}
                    title="Backspace"
                  >
                    <Delete size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Standard Password Form */}
          {activeTab === "form" && (
            <form onSubmit={handleSubmit}>
              {/* User Identifier */}
              <div style={{ marginBottom: 12 }}>
                <label style={sectionLabelStyle}>Account Email or Employee ID</label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setError("");
                  }}
                  style={textInputStyle}
                  placeholder="e.g. Chef@kapila.com or store@kapila.com"
                  autoComplete="username"
                  required
                />
              </div>

              {/* Password Input */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={sectionLabelStyle}>Password</label>
                  {password && (
                    <button
                      type="button"
                      onClick={() => { setPassword(""); setError(""); }}
                      style={{
                        fontSize: 11,
                        color: "#94a3b8",
                        background: "rgba(255, 255, 255, 0.05)",
                        padding: "2px 8px",
                        borderRadius: 5,
                        fontWeight: 600,
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <RotateCcw size={11} /> Clear
                    </button>
                  )}
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
                    placeholder="Enter account password"
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

              {/* Remember Me */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  color: "#cbd5e1",
                  cursor: "pointer",
                  userSelect: "none",
                }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{
                      accentColor: selectedRole.color,
                      width: 16,
                      height: 16,
                      cursor: "pointer",
                    }}
                  />
                  <span>Save persistent session on this device</span>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div style={{
                  color: "#ef4444",
                  fontSize: 12,
                  marginBottom: 12,
                  background: "rgba(239, 68, 68, 0.1)",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: 10,
                  border: "none",
                  background: selectedRole.code === "KPL-CHEF"
                    ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    : selectedRole.code === "KPL-STORE"
                    ? "linear-gradient(135deg, #e8a838 0%, #d49424 100%)"
                    : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                  color: "#080c14",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: `0 6px 20px ${selectedRole.glow}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: loading ? 0.75 : 1,
                  touchAction: "manipulation"
                }}
              >
                {loading ? "Signing in..." : <>Sign In as {selectedRole.label}</>}
              </button>
            </form>
          )}

          {/* Multi-Agent Swarm Real-Time Telemetry Strip */}
          <div style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
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
              <span style={{ color: "#10b981", fontWeight: 800, fontSize: 10 }}>ALL AGENTS SYNCED</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              <span style={agentBadgeStyle}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981" }} />
                <strong>KitchenOps:</strong> <span style={{ color: "#10b981" }}>READY</span>
              </span>
              <span style={agentBadgeStyle}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981" }} />
                <strong>StoreOps:</strong> <span style={{ color: "#10b981" }}>LIFO SYNC</span>
              </span>
              <span style={agentBadgeStyle}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981" }} />
                <strong>SecOps:</strong> <span style={{ color: "#10b981" }}>ONLINE</span>
              </span>
              <span style={agentBadgeStyle}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#38bdf8" }} />
                <strong>TouchpadSentinel:</strong> <span style={{ color: "#38bdf8" }}>ACTIVE</span>
              </span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

const sectionLabelStyle = {
  color: "#94a3b8",
  fontSize: 11,
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
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s ease",
};

const agentBadgeStyle = {
  fontSize: 10,
  padding: "2px 7px",
  borderRadius: 5,
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#cbd5e1",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};
