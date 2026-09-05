import { useRef } from "react";
import Card from "../../../components/Card";
import { COLORS } from "../../../styles/colors";
import { FileImage, Camera, QrCode } from "lucide-react";

export default function ScanIndentPanel({ onScan, scanning, scanText, msg }) {
  const fileRef = useRef();

  const handleScan = (e) => {
    const file = e.target.files[0];
    if (file) {
      onScan(file);
    }
  };

  return (
    <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Scan Indent Form
      </p>

      <div
        onClick={() => fileRef.current?.click()}
        style={{ 
          border: `2px dashed #cbd5e1`, 
          borderRadius: 8, 
          height: 160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center", 
          cursor: "pointer",
          backgroundColor: "#f8fafc",
          transition: "border-color 0.2s"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.info)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#cbd5e1")}
      >
        <FileImage size={48} color="#94a3b8" style={{ marginBottom: 8 }} />
        <p style={{ color: COLORS.muted, fontSize: 13, margin: 0, fontWeight: 500 }}>Tap to upload</p>
        <p style={{ color: "#94a3b8", fontSize: 11, marginTop: 4, margin: 0 }}>JPG, PNG supported</p>
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleScan} />

      <div style={{ display: "flex", alignItems: "center", margin: "16px 0", color: "#cbd5e1" }}>
        <div style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
        <span style={{ fontSize: 12, padding: "0 8px", color: "#94a3b8", textTransform: "lowercase" }}>or</span>
        <div style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button 
          style={{ 
            width: "100%", 
            height: 36, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: 8, 
            border: `1px solid #e2e8f0`, 
            borderRadius: 6, 
            backgroundColor: "white",
            color: COLORS.text,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer"
          }}
        >
          <Camera size={16} /> Use Camera
        </button>
        <button 
          style={{ 
            width: "100%", 
            height: 36, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: 8, 
            border: `1px solid #e2e8f0`, 
            borderRadius: 6, 
            backgroundColor: "white",
            color: COLORS.text,
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer"
          }}
        >
          <QrCode size={16} /> Scan QR Code
        </button>
      </div>

      <div style={{ marginTop: "auto", minHeight: 40, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
        {scanning && <p style={{ color: COLORS.info, fontSize: 12, margin: "8px 0 0", textAlign: "center", fontWeight: 500 }}>⏳ {scanText}</p>}
        {!scanning && scanText && <p style={{ color: COLORS.success, fontSize: 12, margin: "8px 0 0", textAlign: "center", fontWeight: 500 }}>{scanText}</p>}
        {msg && <p style={{ color: COLORS.success, fontSize: 12, margin: "8px 0 0", textAlign: "center", fontWeight: 500 }}>{msg}</p>}
      </div>
    </Card>
  );
}
