import { useState } from "react";
import { COLORS, SPACING, RADIUS, SHADOW } from "../../styles/colors";

const SIZE_PRESETS = {
  compact: 640,
  default: 900,
  expanded: 1200,
};

/**
 * Reusable modal container with a size-toggle affordance.
 * Caps width at both a px preset and 90vw so it never overflows small
 * viewports, and caps height at 90vh with internal scroll.
 */
export default function ModalShell({
  children,
  onClose,
  title,
  size = "default",
  zIndex = 1000,
}) {
  const [activeSize, setActiveSize] = useState(size);
  const maxWidth = SIZE_PRESETS[activeSize] || SIZE_PRESETS.default;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACING.lg,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "90vh",
          background: COLORS.surface,
          borderRadius: RADIUS.lg,
          boxShadow: SHADOW.lg || SHADOW.md,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${SPACING.lg}px ${SPACING.xl}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 16, color: COLORS.text }}>
            {title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: SPACING.sm }}>
            <div
              style={{
                display: "flex",
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                overflow: "hidden",
              }}
            >
              {Object.keys(SIZE_PRESETS).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSize(key)}
                  title={`${key} size`}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                    fontSize: 11,
                    background: activeSize === key ? COLORS.brandLight : "transparent",
                    color: activeSize === key ? COLORS.text : COLORS.muted,
                  }}
                >
                  {key === "compact" ? "S" : key === "default" ? "M" : "L"}
                </button>
              ))}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 18,
                  color: COLORS.muted,
                  lineHeight: 1,
                  padding: 4,
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: SPACING.xl }}>{children}</div>
      </div>
    </div>
  );
}
