import { useState } from "react";
import { COLORS } from "../styles/colors";
import { useBreakpoint } from "../styles/responsive";

export default function Card({ children, style = {}, onClick, variant = "default", ...props }) {
  const [isHovered, setIsHovered] = useState(false);
  const isInteractive = variant === "interactive" || !!onClick;

  const getVariantStyles = () => {
    switch (variant) {
      case "interactive":
        return {
          cursor: "pointer",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          borderColor: isHovered ? "var(--color-accent-primary)" : COLORS.border,
          boxShadow: isHovered 
            ? "0 4px 6px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06)" 
            : "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)",
        };
      case "highlighted":
        return {
          background: "#f8fafc",
          borderColor: "var(--color-border-strong)",
        };
      default:
        return {};
    }
  };

  const { isMobile } = useBreakpoint();

  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => isInteractive && setIsHovered(true)}
      onMouseLeave={() => isInteractive && setIsHovered(false)}
      style={{ 
        background: COLORS.surface, 
        border: `1px solid ${COLORS.border}`, 
        borderRadius: 14, 
        padding: isMobile ? 14 : 20, 
        boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)",
        minWidth: 0,
        ...getVariantStyles(),
        ...style 
      }}
      {...props}
    >
      {children}
    </div>
  );
}

