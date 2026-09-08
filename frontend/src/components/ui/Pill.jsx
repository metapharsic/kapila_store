import { RADIUS, PILL_VARIANTS } from "../../styles/colors";

/**
 * Pill — fully-rounded chip for status/route/tag/count labels.
 * variant: "success" | "warning" | "danger" | "info" | "neutral"
 */
export default function Pill({ children, variant = "neutral", style = {}, ...props }) {
  const { bg, fg } = PILL_VARIANTS[variant] || PILL_VARIANTS.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 10px",
        borderRadius: RADIUS.full,
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.6,
        whiteSpace: "nowrap",
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
