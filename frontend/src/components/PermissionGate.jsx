import { useAuth } from "../context/AuthContext";

export default function PermissionGate({ permission, any, fallback = null, children }) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const allowed = any?.length ? hasAnyPermission(any) : hasPermission(permission);
  return allowed ? children : fallback;
}
