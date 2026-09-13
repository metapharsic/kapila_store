import { useRef, useState } from "react";
import Card from "../../../components/Card";
import { COLORS } from "../../../styles/colors";
import { ChevronDown, FileImage, Camera, QrCode, Calendar } from "lucide-react";

const formatIndentLabel = (indent) => {
  const dept = indent.dept || "";
  const statusLabel = indent.status === "approved" ? "✓ Approved" : indent.status === "partial" ? "⚡ Partial" : "⏳ Pending Review";
  try {
    const d = new Date(indent.date);
    const dateStr = isNaN(d.getTime())
      ? indent.date
      : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    return `#${indent.id} · ${dept} · ${dateStr} [${statusLabel}]`;
  } catch {
    return `#${indent.id} · ${dept} [${statusLabel}]`;
  }
};

const formatDate = (dateStr) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
};

export default function IssuanceLeftPanel({
  pendingIndents,
  selected,
  onSelect,
  onIssue,
  issueQtys,
  availableStock,
  onScan,
  scanning,
  scanText,
  msg,
  onShowHistory,
}) {
  const fileRef = useRef();
  const [scanOpen, setScanOpen] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) onScan(file);
    e.target.value = "";
  };

  const itemCount = selected?.items?.length || 0;

  // Count sufficient vs insufficient using availableStock + issueQtys
  let sufficientCount = 0;
  let insufficientCount = 0;
  if (selected?.items) {
    selected.items.forEach((it, idx) => {
      const avail = (it.item_code && availableStock[it.item_code] != null)
        ? availableStock[it.item_code]
        : (availableStock[it.name?.toLowerCase()] ?? 0);
      const qty = parseFloat(issueQtys[idx] ?? it.qty) || 0;
      if (avail >= qty) sufficientCount++;
      else insufficientCount++;
    });
  }



  return (
    <Card style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0, padding: "20px" }}>
      {/* Section label */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: COLORS.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Issue From Pending Indent
        </p>
        <button
          type="button"
          onClick={onShowHistory}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
            color: "#e8a838",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: 0,
            outline: "none",
          }}
        >
          <Calendar size={13} style={{ color: "#e8a838" }} />
          Indent History
        </button>
      </div>

      {/* Select Indent */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 14, color: COLORS.text, fontWeight: 700, display: "block", marginBottom: 6 }}>
          Select Indent
        </label>
        <div style={{ position: "relative" }}>
          <select
            value={selected?.id || ""}
            onChange={(e) => {
              const ind = pendingIndents.find((i) => String(i.id) === e.target.value);
              onSelect(ind || null);
            }}
            style={{
              width: "100%",
              padding: "9px 36px 9px 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              appearance: "none",
              backgroundColor: "#ffffff",
              fontSize: 13,
              color: COLORS.text,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">-- Choose pending indent --</option>
            {selected && selected.scanned && !selected.id && (
              <option value="" disabled>
                📄 Scanned Indent ({selected.dept})
              </option>
            )}
            {pendingIndents.map((i) => (
              <option key={i.id} value={String(i.id)}>
                {formatIndentLabel(i)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            color="#64748b"
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          />
        </div>
      </div>

      {/* Indent details — only shown when an indent is selected */}
      {selected && (
        <>
          {/* Department */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Department</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0 }}>{selected.dept}</p>
          </div>

          {/* Indent Type Badge */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 6 }}>Indent Type</p>
            {(() => {
              const isAdhoc = (selected.indent_type || "routine") === "adhoc";
              return (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: isAdhoc ? "#FEF3C7" : "#D1FAE5",
                  color: isAdhoc ? "#92400E" : "#065F46",
                  border: `1px solid ${isAdhoc ? "#FCD34D" : "#6EE7B7"}`,
                }}>
                  {isAdhoc ? "⚡ Ad-Hoc (Emergency)" : "✓ Routine"}
                </span>
              );
            })()}
          </div>

          {/* Date Needed */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Date Needed</p>
            <p style={{ fontSize: 14, fontWeight: 500, color: COLORS.text, margin: 0 }}>{formatDate(selected.date)}</p>
          </div>

          {/* Items */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: COLORS.muted, marginBottom: 4 }}>Items</p>
            <p style={{ fontSize: 14, fontWeight: 500, color: COLORS.text, margin: 0 }}>{itemCount} items requested</p>
          </div>

          {/* Stock Summary */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, marginBottom: 8 }}>Stock Summary:</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ backgroundColor: "#dcfce7", color: "#16a34a", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {sufficientCount} sufficient
              </span>
              {insufficientCount > 0 && (
                <span style={{ backgroundColor: "#fee2e2", color: "#dc2626", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  ⚠ {insufficientCount} low stock
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Scan section — collapsible at bottom */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14, marginBottom: 14 }}>
        <button
          onClick={() => setScanOpen((v) => !v)}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: COLORS.muted, fontSize: 12, fontWeight: 500, padding: 0 }}
        >
          <FileImage size={14} />
          AI Scan Paper Form
          <ChevronDown size={12} style={{ transform: scanOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
        </button>

        {scanOpen && (
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={scanning}
              style={{
                flex: 1,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                backgroundColor: "white",
                color: COLORS.text,
                fontSize: 12,
                fontWeight: 500,
                cursor: scanning ? "wait" : "pointer",
              }}
            >
              <Camera size={13} /> Upload
            </button>
            <button
              style={{
                flex: 1,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                backgroundColor: "white",
                color: COLORS.text,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <QrCode size={13} /> QR Code
            </button>
          </div>
        )}

        {scanning && (
          <p style={{ color: "#3b82f6", fontSize: 11, marginTop: 6, fontWeight: 500 }}>⏳ {scanText}</p>
        )}
        {!scanning && scanText && (
          <p style={{ color: "#16a34a", fontSize: 11, marginTop: 6, fontWeight: 500 }}>{scanText}</p>
        )}
        {msg && (
          <p style={{ color: msg.startsWith("Error") ? "#dc2626" : "#16a34a", fontSize: 11, marginTop: 6, fontWeight: 500 }}>{msg}</p>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />


    </Card>
  );
}
