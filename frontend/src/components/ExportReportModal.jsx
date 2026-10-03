import { useState, useEffect } from "react";
import { COLORS } from "../styles/colors";
import {
  FileSpreadsheet, CheckCircle2, Loader2, Download,
} from "lucide-react";
import { reports } from "../api";
import ModalShell from "./ui/ModalShell";

export default function ExportReportModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      setError("");
      reports.previewInventoryMetadata()
        .then((res) => {
          if (res.success) setPreview(res.data);
        })
        .catch((err) => console.warn("Preview load failed:", err.message));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      await reports.downloadInventoryExcel();
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to generate Excel report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      onClose={onClose}
      size="compact"
      title={(
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "rgba(217, 119, 6, 0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #D97706",
              flexShrink: 0,
            }}
          >
            <FileSpreadsheet size={19} color="#D97706" />
          </div>
          <div>
            <div>Inventory Excel Report</div>
            <div style={{ fontSize: 11, fontWeight: 400, color: COLORS.muted }}>
              7 Formatted Sheets • Live Store Data
            </div>
          </div>
        </div>
      )}
    >
      {/* KPI Snapshot */}
      {preview && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0", minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>TOTAL SKUS</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{preview.total_skus}</div>
          </div>
          <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0", minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>VALUATION</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#D97706" }}>
              ₹{(preview.total_valuation / 100000).toFixed(2)}L
            </div>
          </div>
          <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0", minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>BATCHES</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{preview.total_batches}</div>
          </div>
          <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0", minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>LOW STOCK</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#DC2626" }}>{preview.low_stock_count}</div>
          </div>
        </div>
      )}

      {/* Included Sheets Badges */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8, textTransform: "uppercase" }}>
          7 Dedicated Worksheets Generated:
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[
            "1. Executive Summary",
            "2. Master Stock Valuation",
            "3. Batch & FEFO Expiry",
            "4. Department Consumption",
            "5. Procurement & GRN",
            "6. Reorder Schedule",
            "7. Audit & Variances",
          ].map((s) => (
            <span
              key={s}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 8px",
                borderRadius: 6,
                backgroundColor: "#EFF6FF",
                color: "#1D4ED8",
                border: "1px solid #BFDBFE",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Success Banner */}
      {success && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#DCFCE7",
            border: "1px solid #86EFAC",
            borderRadius: 8,
            color: "#166534",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <CheckCircle2 size={18} />
          Excel report compiled and downloaded successfully! Check your downloads folder.
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "#FEE2E2",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            color: "#991B1B",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* Footer Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
          borderTop: `1px solid ${COLORS.border}`,
          paddingTop: 16,
        }}
      >
        <button
          onClick={onClose}
          style={{
            padding: "9px 18px",
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            backgroundColor: "#FFFFFF",
            color: "#334155",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {success ? "Close" : "Cancel"}
        </button>
        <button
          onClick={handleExport}
          disabled={loading}
          style={{
            padding: "9px 20px",
            borderRadius: 8,
            border: "none",
            backgroundColor: loading ? "#94A3B8" : "#D97706",
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 2px 4px rgba(217, 119, 6, 0.2)",
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Compiling Workbook...
            </>
          ) : (
            <>
              <Download size={16} /> Download Complete Excel Report (.xlsx)
            </>
          )}
        </button>
      </div>
    </ModalShell>
  );
}
