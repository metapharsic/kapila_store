import { COLORS } from "../styles/colors";

export default function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, display: "block", marginBottom: 6 }}>
          {label}
        </label>
      )}
      <select {...props}>{children}</select>
    </div>
  );
}
