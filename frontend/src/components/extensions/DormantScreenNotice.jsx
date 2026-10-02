import React from "react";
import { 
  Wrench, Users, Power, Sparkles, Layers, ArrowLeft, 
  CheckCircle2, Eye, ShieldCheck, ChevronRight 
} from "lucide-react";
import { COLORS } from "../../styles/colors";
import { useAppContext } from "../../context/AppContext";
import { MODULAR_EXTENSIONS_CONFIG } from "./ModularExtensionsModal";

export default function DormantScreenNotice({ moduleKey, onEnable }) {
  const { toggleModularExtension, setCurrentScreen } = useAppContext();
  const config = MODULAR_EXTENSIONS_CONFIG[moduleKey] || {
    title: "Modular Enterprise Extension",
    description: "This advanced extension module is currently dormant.",
    features: [],
    agent: "Agent Orchestrator",
    agentRole: "System Controller"
  };

  const handleEnableAndOpen = () => {
    if (onEnable) {
      onEnable();
    } else {
      toggleModularExtension(moduleKey, true);
    }
  };

  return (
    <div style={{
      maxWidth: 720,
      margin: "40px auto",
      padding: "32px 28px",
      background: "#181a20",
      border: "1px solid rgba(232, 168, 56, 0.35)",
      borderRadius: 16,
      boxShadow: "0 20px 40px -15px rgba(0,0,0,0.6)",
      color: "#fff"
    }}>
      {/* Header icon badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: "rgba(232, 168, 56, 0.15)",
          border: "1px solid rgba(232, 168, 56, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: COLORS.accent
        }}>
          {moduleKey === "maintenance" ? <Wrench size={26} /> : <Users size={26} />}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "2px 8px",
              borderRadius: 12,
              background: "rgba(232, 168, 56, 0.2)",
              color: COLORS.accent,
              border: "1px solid rgba(232, 168, 56, 0.35)"
            }}>
              Modular Extension Dormant
            </span>
          </div>
          <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: "#fff" }}>
            {config.title}
          </h2>
        </div>
      </div>

      <p style={{ fontSize: 13.5, color: "#9ca3af", lineHeight: 1.6, marginBottom: 20 }}>
        This module is currently <strong>hidden/dormant</strong> in your workspace to keep daily storekeeping, inventory issuance, and chef indents lean and focused. You can activate it at any time with a single click.
      </p>

      {/* Feature capabilities */}
      <div style={{
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.07)",
        borderRadius: 10,
        padding: 18,
        marginBottom: 24
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: COLORS.accent, letterSpacing: "0.06em", marginBottom: 10 }}>
          Module Capabilities & Enterprise Features:
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
          {config.features?.map((feat, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#d1d5db" }}>
              <CheckCircle2 size={13} color="#10b981" />
              <span>{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-agent info */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: 11.5,
        color: COLORS.muted,
        marginBottom: 28
      }}>
        <Sparkles size={14} color={COLORS.accent} />
        <span>Managed by <strong>{config.agent}</strong> ({config.agentRole}).</span>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <button
          onClick={() => setCurrentScreen("dashboard")}
          style={{
            background: "transparent",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "#9ca3af",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        <button
          onClick={handleEnableAndOpen}
          style={{
            background: COLORS.accent,
            color: "#161922",
            border: "none",
            borderRadius: 8,
            padding: "10px 22px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(232, 168, 56, 0.3)"
          }}
        >
          <Power size={15} />
          Enable {config.shortLabel} Now
        </button>
      </div>
    </div>
  );
}
