import { useState, useEffect } from "react";
import { COLORS } from "../styles/colors";
import {
  FileSpreadsheet, CheckCircle2, Loader2, Download, X,
  ShieldCheck, Database, Cpu, Sparkles, Server, Laptop
} from "lucide-react";
import { reports } from "../api";

export default function ExportReportModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [agentStep, setAgentStep] = useState(0);

  const agents = [
    {
      id: "architect",
      name: "Agent 1: Architect",
      icon: <ShieldCheck size={16} color="#0284C7" />,
      desc: "7-Sheet enterprise workbook schema & RBAC permissions matrix",
    },
    {
      id: "data",
      name: "Agent 2: Data Agent",
      icon: <Database size={16} color="#16A34A" />,
      desc: "Live Knex aggregation across 5,600+ stock items, batches, and issuances",
    },
    {
      id: "backend",
      name: "Agent 3: Backend Core",
      icon: <Cpu size={16} color="#9333EA" />,
      desc: "ExcelJS workbook compiler with native SUM formulas & auto-fit columns",
    },
    {
      id: "ai",
      name: "Agent 5: AI Store Advisor",
      icon: <Sparkles size={16} color="#D97706" />,
      desc: "Executive store health score, capital allocation, and spoilage prevention",
    },
    {
      id: "devops",
      name: "Agent 6: DevOps & QA",
      icon: <Server size={16} color="#EA580C" />,
      desc: "Binary stream packaging, audit logging, and payload integrity verification",
    },
    {
      id: "frontend",
      name: "Agent 4: Frontend UI",
      icon: <Laptop size={16} color="#2563EB" />,
      desc: "Blob streaming, browser attachment dispatch, and user notification",
    },
  ];

  useEffect(() => {
    if (isOpen) {
      setSuccess(false);
      setError("");
      setAgentStep(0);
      // Fetch metadata preview
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
    setAgentStep(1);

    try {
      // Step through agent milestones for visual clarity
      setTimeout(() => setAgentStep(2), 300);
      setTimeout(() => setAgentStep(3), 600);
      setTimeout(() => setAgentStep(4), 900);
      setTimeout(() => setAgentStep(5), 1200);

      await reports.downloadInventoryExcel();

      setAgentStep(6);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Failed to generate Excel report");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          width: "100%",
          maxWidth: 640,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          border: `1px solid ${COLORS.border}`,
          animation: "modalFadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            backgroundColor: "#0F172A",
            color: "#FFFFFF",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: "rgba(217, 119, 6, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid #D97706",
              }}
            >
              <FileSpreadsheet size={22} color="#FBBF24" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>
                Enterprise Inventory Excel Report Unit
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#94A3B8" }}>
                Multi-Agent Pipeline • 7 Formatted Sheets • Live Store Data
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 24, maxHeight: "70vh", overflowY: "auto" }}>
          {/* KPI Snapshot */}
          {preview && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>TOTAL SKUS</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{preview.total_skus}</div>
              </div>
              <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>VALUATION</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#D97706" }}>
                  ₹{(preview.total_valuation / 100000).toFixed(2)}L
                </div>
              </div>
              <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>BATCHES</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{preview.total_batches}</div>
              </div>
              <div style={{ padding: "10px 14px", backgroundColor: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
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

          {/* Multi-Agent Status Pipeline */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 10, textTransform: "uppercase" }}>
              Multi-Agent Orchestration Status:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {agents.map((ag, idx) => {
                const isDone = agentStep > idx || success;
                const isCurrent = agentStep === idx + 1 && loading;
                return (
                  <div
                    key={ag.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 8,
                      backgroundColor: isCurrent ? "#FEF3C7" : isDone ? "#F0FDF4" : "#F8FAFC",
                      border: `1px solid ${isCurrent ? "#F59E0B" : isDone ? "#BBF7D0" : "#E2E8F0"}`,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {ag.icon}
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1E293B" }}>
                          {ag.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748B" }}>{ag.desc}</div>
                      </div>
                    </div>
                    <div>
                      {isDone ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#16A34A" }}>
                          <CheckCircle2 size={14} /> Ready
                        </span>
                      ) : isCurrent ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#D97706" }}>
                          <Loader2 size={14} className="animate-spin" /> Processing
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>Queued</span>
                      )}
                    </div>
                  </div>
                );
              })}
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
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "#F8FAFC",
            borderTop: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "flex-end",
            gap: 12,
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
      </div>
    </div>
  );
}
