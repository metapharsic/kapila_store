export default function KplCodeBadge({ code }) {
  const isNew = !code || code === "KPL-NEW" || code === "NEW";
  const displayCode = code || "KPL-NEW";

  const style = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    backgroundColor: isNew ? "#fbbf24" : "#94a3b8",
    color: isNew ? "#1e293b" : "#ffffff", // dark text for amber, white for gray
  };

  return <span style={style}>{displayCode}</span>;
}
