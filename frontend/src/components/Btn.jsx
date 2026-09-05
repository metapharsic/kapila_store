import { useState } from "react";
import { COLORS } from "../styles/colors";

const variants = {
  primary: { background: COLORS.brand,       color: COLORS.surface },
  ghost:   { background: "transparent",      color: COLORS.text,    border: `1px solid ${COLORS.border}` },
  danger:  { background: COLORS.danger,      color: COLORS.surface },
  success: { background: COLORS.success,     color: COLORS.surface },
  warning: { background: COLORS.warning,     color: COLORS.surface },
};

const hovers = {
  primary: { background: COLORS.brandDark },
  ghost:   { background: "#f1f5f9" },
  danger:  { background: "#e11d48" },
  success: { background: COLORS.brandDark },
  warning: { background: "#d97706" },
};

export default function Btn({ children, onClick, variant = "primary", icon, small, style = {}, disabled, loading }) {
  const [isHovered, setIsHovered] = useState(false);
  const isInteractive = !disabled && !loading;

  return (
    <button
      onClick={isInteractive ? onClick : undefined}
      disabled={disabled || loading}
      onMouseEnter={() => isInteractive && setIsHovered(true)}
      onMouseLeave={() => isInteractive && setIsHovered(false)}
      style={{
        ...variants[variant],
        ...(isHovered ? hovers[variant] : {}),
        padding: small ? "6px 12px" : "8px 18px",
        opacity: isInteractive ? 1 : 0.6,
        cursor: isInteractive ? "pointer" : "not-allowed",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        fontFamily: "'Inter', sans-serif",
        fontSize: "13.5px",
        fontWeight: 500,
        borderRadius: "8px",
        transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
        ...style,
      }}
    >
      {loading && <span className="pulse" style={{ width: 12, height: 12, border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", display: "inline-block" }}></span>}
      {!loading && icon && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>}
      {children}
    </button>
  );
}

