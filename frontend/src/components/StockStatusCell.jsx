export default function StockStatusCell({ available, issueQty }) {
  const isSufficient = available >= issueQty;

  const style = {
    padding: "6px 10px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 500,
    backgroundColor: isSufficient ? "#dcfce7" : "#fee2e2",
    color: isSufficient ? "#16a34a" : "#dc2626",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px"
  };

  return (
    <div style={style}>
      <span>{isSufficient ? "✓" : "⚠"}</span>
      <span>{available} available</span>
    </div>
  );
}
