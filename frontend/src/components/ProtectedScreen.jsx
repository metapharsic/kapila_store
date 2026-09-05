import { COLORS } from "../styles/colors";
import { useAuth } from "../context/AuthContext";

export default function ProtectedScreen({ permission, children }) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const allowed = Array.isArray(permission)
    ? hasAnyPermission(permission)
    : hasPermission(permission);

  if (allowed) return children;

  return (
    <div style={{
      minHeight: 280,
      display: "grid",
      placeItems: "center",
      color: COLORS.text,
    }}>
      <div style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 24,
        maxWidth: 420,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Access restricted</div>
        <div style={{ color: COLORS.muted, fontSize: 14 }}>Your account does not have permission to view this section.</div>
      </div>
    </div>
  );
}
