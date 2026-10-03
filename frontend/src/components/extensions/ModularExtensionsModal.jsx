import React from "react";
import { 
  Wrench, Users, ShieldCheck, CheckCircle2, Eye, EyeOff, 
  Sparkles, X, Power, Layers, ArrowRight, Info, Check, Clock
} from "lucide-react";
import { COLORS } from "../../styles/colors";
import { useAppContext } from "../../context/AppContext";

export const MODULAR_EXTENSIONS_CONFIG = {
  maintenance: {
    id: "maintenance",
    title: "Commercial Kitchen & Facility CMMS",
    shortLabel: "Kitchen CMMS",
    navLabel: "Kitchen Asset CMMS",
    category: "Kitchen & Assets",
    icon: <Wrench size={18} />,
    description: "Complete equipment lifecycle, breakdown maintenance tickets, preventive maintenance (PM) routines, spare parts consumption, and vendor AMC contracts.",
    features: [
      "Preventive Maintenance schedules (Daily/Weekly/Monthly)",
      "Breakdown work orders & technician dispatch",
      "Spare parts inventory deduction from store",
      "Equipment lifecycle & AMC vendor tracking"
    ],
    agent: "Agent Mechanicus",
    agentRole: "Facility & Equipment Reliability Engineer"
  },
  staff_audit: {
    id: "staff_audit",
    title: "Staff HRMS, Split-Shifts & Midnight Night Audit",
    shortLabel: "Staff & Night Audit",
    navLabel: "Staff & Night Audit",
    category: "Kitchen & Assets",
    icon: <Users size={18} />,
    description: "Comprehensive kitchen & store crew rostering, split-shift attendance management, shift handoffs, and automated midnight day-end closing reconciliation.",
    features: [
      "Department crew shift rosters & split-shift logs",
      "Attendance check-in & biometric verification",
      "Automated midnight day-end closing audit",
      "Shift handoff operational discrepancy logs"
    ],
    agent: "Agent Chronos",
    agentRole: "Human Capital & Midnight Closing Auditor"
  }
};

export default function ModularExtensionsModal({ isOpen, onClose }) {
  const { 
    modularExtensions, 
    toggleModularExtension, 
    setModularExtensions, 
    setCurrentScreen 
  } = useAppContext();

  if (!isOpen) return null;

  const dormantCount = Object.keys(MODULAR_EXTENSIONS_CONFIG).filter(
    (key) => !modularExtensions[key]
  ).length;

  const handleEnableAll = () => {
    setModularExtensions({ maintenance: true, staff_audit: true });
  };

  const handleHideAll = () => {
    setModularExtensions({ maintenance: false, staff_audit: false });
  };

  const handleNavigateToModule = (moduleKey) => {
    if (!modularExtensions[moduleKey]) {
      toggleModularExtension(moduleKey, true);
    }
    setCurrentScreen(moduleKey);
    onClose();
  };

  return (
    <div 
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        style={{
          width: "100%",
          maxWidth: "min(680px, 90vw)",
          maxHeight: "90vh",
          background: "#181a20",
          border: "1px solid rgba(232, 168, 56, 0.35)",
          borderRadius: 14,
          boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease-out"
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          flexShrink: 0,
          background: "linear-gradient(180deg, rgba(232, 168, 56, 0.08) 0%, rgba(0, 0, 0, 0) 100%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "rgba(232, 168, 56, 0.15)",
              border: "1px solid rgba(232, 168, 56, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: COLORS.accent
            }}>
              <Layers size={22} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#fff" }}>
                  Modular Enterprise Extensions
                </h3>
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: dormantCount > 0 ? "rgba(232, 168, 56, 0.18)" : "rgba(16, 185, 129, 0.18)",
                  color: dormantCount > 0 ? COLORS.accent : "#10b981",
                  border: `1px solid ${dormantCount > 0 ? "rgba(232, 168, 56, 0.35)" : "rgba(16, 185, 129, 0.35)"}`
                }}>
                  {dormantCount > 0 ? `${dormantCount} Dormant` : "All Active ✓"}
                </span>
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: COLORS.muted }}>
                Multi-Agent Orchestrator · Turn advanced facility and HR modules on or off on demand
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: COLORS.muted,
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Informational Guidance Callout */}
        <div style={{
          padding: "12px 24px",
          background: "rgba(255, 255, 255, 0.02)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          flexShrink: 0
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#9ca3af" }}>
            <Info size={15} color={COLORS.accent} />
            <span>These modules are kept hidden by default to keep daily store & kitchen operations clean.</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleEnableAll}
              style={{
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                color: "#10b981",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              ⚡ Enable All
            </button>
            <button
              onClick={handleHideAll}
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#9ca3af",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11.5,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              🔒 Hide All
            </button>
          </div>
        </div>

        {/* Modules List */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0, overflowY: "auto" }}>
          {Object.entries(MODULAR_EXTENSIONS_CONFIG).map(([key, config]) => {
            const isEnabled = !!modularExtensions[key];
            return (
              <div 
                key={key}
                style={{
                  background: isEnabled ? "rgba(255, 255, 255, 0.04)" : "rgba(255, 255, 255, 0.02)",
                  border: `1px solid ${isEnabled ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.08)"}`,
                  borderRadius: 10,
                  padding: 16,
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: isEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                      color: isEnabled ? "#10b981" : "#9ca3af",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}>
                      {config.icon}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h4 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: "#fff" }}>
                          {config.title}
                        </h4>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: isEnabled ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.08)",
                          color: isEnabled ? "#34d399" : "#9ca3af",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}>
                          {isEnabled ? <Check size={11} /> : <EyeOff size={11} />}
                          {isEnabled ? "ACTIVE IN SIDEBAR" : "DORMANT / HIDDEN"}
                        </span>
                      </div>
                      <p style={{ margin: "6px 0 10px", fontSize: 12, color: "#9ca3af", lineHeight: 1.45 }}>
                        {config.description}
                      </p>
                      
                      {/* Features bullets */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 4, marginBottom: 10 }}>
                        {config.features.map((feat, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: isEnabled ? "#d1d5db" : "#6b7280" }}>
                            <span style={{ color: isEnabled ? "#10b981" : "#4b5563" }}>•</span>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>

                      {/* Agent banner */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: COLORS.accent }}>
                        <Sparkles size={12} />
                        <span>Orchestrated by <strong>{config.agent}</strong> ({config.agentRole})</span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle & Action buttons */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => toggleModularExtension(key)}
                      style={{
                        background: isEnabled ? "#10b981" : "rgba(255, 255, 255, 0.1)",
                        border: "none",
                        color: isEnabled ? "#064e3b" : "#fff",
                        borderRadius: 20,
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.15s"
                      }}
                    >
                      <Power size={13} />
                      {isEnabled ? "Enabled ✓" : "Enable"}
                    </button>

                    {isEnabled && (
                      <button
                        onClick={() => handleNavigateToModule(key)}
                        style={{
                          background: "transparent",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          color: COLORS.accent,
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        Open <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          flexShrink: 0,
          background: "rgba(0, 0, 0, 0.2)"
        }}>
          <span style={{ fontSize: 11.5, color: COLORS.muted }}>
            Settings automatically saved to browser storage (<code>kapila_modular_extensions</code>)
          </span>
          <button
            onClick={onClose}
            style={{
              background: COLORS.accent,
              color: "#161922",
              border: "none",
              borderRadius: 6,
              padding: "7px 16px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
