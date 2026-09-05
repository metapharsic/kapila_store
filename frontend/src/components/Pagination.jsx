import { COLORS } from "../styles/colors";
import Btn from "./Btn";

export default function Pagination({ page, total, limit, onPage }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: `1px solid ${COLORS.border}` }}>
      <span style={{ fontSize: 12, color: COLORS.muted }}>{total} total</span>
      <Btn variant="ghost" small onClick={() => onPage(page - 1)} disabled={page <= 1}>← Prev</Btn>
      <span style={{ fontSize: 12, color: COLORS.muted }}>Page {page} / {totalPages}</span>
      <Btn variant="ghost" small onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Next →</Btn>
    </div>
  );
}
