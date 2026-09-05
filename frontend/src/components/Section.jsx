import { COLORS } from "../styles/colors";
import { useBreakpoint } from "../styles/responsive";

export default function Section({ title, sub, children, style = {}, onBack }) {
  const { isMobile } = useBreakpoint();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: isMobile ? 16 : 24, ...style }}>
      {(title || sub || onBack) && (
        <div style={{ marginBottom: 16, flexShrink: 0, display: "flex", alignItems: "flex-start", gap: 12 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8,
                padding: "6px 12px", cursor: "pointer", color: COLORS.text,
                display: "flex", alignItems: "center", gap: 6, fontWeight: 500,
                marginTop: title && !isMobile ? 2 : 0, transition: "background 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.border + "40"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              Back
            </button>
          )}
          <div>
            {title && <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: COLORS.text, letterSpacing: "-0.02em", margin: 0 }}>{title}</h1>}
            {sub && <p style={{ color: COLORS.muted, fontSize: 13, margin: 0, marginTop: 3 }}>{sub}</p>}
          </div>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
