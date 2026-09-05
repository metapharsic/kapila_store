export default function SourceBadge({ source }) {
  const isScanned = source === "scanned" || source === "Scanned";
  const isQr = source === "qr" || source === "QR";
  const isManual = !isScanned && !isQr; // fallback

  const style = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };

  if (isScanned) {
    style.backgroundColor = "#eff6ff"; // light blue
    style.color = "#3b82f6"; // source-scanned
  } else if (isQr) {
    style.backgroundColor = "#f3e8ff"; // light purple
    style.color = "#a855f7"; // source-qr
  } else {
    style.backgroundColor = "#dcfce7"; // light green
    style.color = "#22c55e"; // source-manual
  }

  const label = isScanned ? "Scanned" : isQr ? "QR" : "Manual";

  return <span style={style}>{label}</span>;
}
