import { COLORS } from "../styles/colors";

export default function Input({ label, ...props }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: 12 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, display: "block" }}>
          {label}
        </label>
      )}
      <input {...props} />
    </div>
  );
}

