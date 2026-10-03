import { useState } from "react";
import { COLORS, RADIUS, SPACING } from "../styles/colors";
import { UploadCloud, AlertTriangle, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import Btn from "./Btn";
import * as api from "../api";

// Bulk stock import: pick a .xlsx/.xls/.pdf file, review the parsed rows
// (editable qty/price), then commit as inserts or updates.
export default function StockImportModal({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [step, setStep] = useState("pick"); // "pick" | "review" | "done"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // full preview response data
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState("insert_new_only");
  const [result, setResult] = useState(null);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setStep("pick");
    setError("");
    setPreview(null);
    setRows([]);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.stockImport.preview(formData);
      setPreview(res.data);
      setRows(res.data.rows.map((r) => ({ ...r })));
      setStep("review");
    } catch (e) {
      setError(e.message || "Failed to parse file.");
    } finally {
      setLoading(false);
    }
  };

  const updateRow = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const rowStatus = (r) => {
    const remaining = parseFloat(r.remaining);
    if (!r.name || String(r.name).trim() === "") return "skip";
    if (isNaN(remaining) || remaining < 0) return "needs_review";
    if (!r.unit) return "needs_review";
    return "valid";
  };

  const validCount = rows.filter((r) => rowStatus(r) === "valid").length;

  const handleCommit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.stockImport.commit(rows, mode);
      setResult(res.data);
      setStep("done");
      if (onImported) onImported();
    } catch (e) {
      setError(e.message || "Failed to commit import.");
    } finally {
      setLoading(false);
    }
  };

  const statusPill = (status) => {
    const map = {
      valid: { bg: "#ECFDF5", fg: "#047857", label: "Valid" },
      needs_review: { bg: "#FEF3C7", fg: "#B45309", label: "Needs review" },
      skip: { bg: "#FEF2F2", fg: "#B91C1C", label: "Skip" },
    };
    const v = map[status] || map.skip;
    return (
      <span style={{ background: v.bg, color: v.fg, borderRadius: RADIUS.full, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
        {v.label}
      </span>
    );
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.65)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000,
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.lg, padding: SPACING.xxl, width: step === "review" ? 900 : 480,
        maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 8px 32px rgba(15, 23, 42, 0.15)",
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <UploadCloud size={18} /> Import Stock from Excel / PDF
        </h3>
        <p style={{ fontSize: 13, color: COLORS.muted, marginBottom: SPACING.lg }}>
          Upload a spreadsheet or PDF of your inventory. You'll review every row before anything is saved.
        </p>

        {error && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FCA5A5", color: "#B91C1C",
            borderRadius: RADIUS.sm, padding: "10px 12px", fontSize: 12.5, marginBottom: SPACING.lg,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <XCircle size={16} /> {error}
          </div>
        )}

        {step === "pick" && (
          <>
            <div style={{
              border: `2px dashed ${COLORS.border}`, borderRadius: RADIUS.md, padding: SPACING.xxl,
              textAlign: "center", marginBottom: SPACING.lg,
            }}>
              <FileSpreadsheet size={28} color={COLORS.muted} style={{ marginBottom: 8 }} />
              <input
                type="file"
                accept=".xlsx,.xls,.pdf"
                onChange={(e) => setFile(e.target.files[0] || null)}
                style={{ fontSize: 12.5 }}
              />
              {file && <p style={{ fontSize: 12, color: COLORS.text, marginTop: 8 }}>{file.name}</p>}
              <p style={{ fontSize: 11.5, color: COLORS.muted, marginTop: 10 }}>
                Excel (.xlsx/.xls) is parsed reliably from real table structure. PDF text extraction is
                approximate — rows will be flagged for review.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={handleUpload} disabled={!file} loading={loading} style={{ flex: 1 }}>
                Parse File
              </Btn>
              <Btn variant="ghost" onClick={handleClose} style={{ border: `1px solid ${COLORS.border}`, flex: 1 }}>
                Cancel
              </Btn>
            </div>
          </>
        )}

        {step === "review" && preview && (
          <>
            {preview.lowConfidence && (
              <div style={{
                background: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E",
                borderRadius: RADIUS.sm, padding: "10px 12px", fontSize: 12.5, marginBottom: SPACING.md,
                display: "flex", alignItems: "flex-start", gap: 8,
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{preview.confidenceMessage}</span>
              </div>
            )}

            <div style={{ display: "flex", gap: 16, fontSize: 12, color: COLORS.muted, marginBottom: SPACING.md, flexWrap: "wrap" }}>
              <span>{preview.previewRowCount} of {preview.totalRowsParsed} rows shown</span>
              <span style={{ color: "#047857" }}>{validCount} valid</span>
              <span style={{ color: "#B91C1C" }}>{preview.invalidRowCount} flagged</span>
              {preview.unmappedHeaders && preview.unmappedHeaders.length > 0 && (
                <span>Ignored columns: {preview.unmappedHeaders.join(", ")}</span>
              )}
            </div>

            <div style={{ overflowX: "auto", border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, marginBottom: SPACING.lg }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: COLORS.bg }}>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Item Code</th>
                    <th style={thStyle}>Qty</th>
                    <th style={thStyle}>Unit</th>
                    <th style={thStyle}>Price</th>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const status = rowStatus(r);
                    return (
                      <tr key={idx} style={{ borderTop: `1px solid ${COLORS.border}`, opacity: status === "skip" ? 0.6 : 1 }}>
                        <td style={tdStyle}>{statusPill(status)}</td>
                        <td style={tdStyle}>{r.name || <em style={{ color: COLORS.danger }}>missing</em>}</td>
                        <td style={tdStyle}>{r.item_code || "—"}</td>
                        <td style={tdStyle}>
                          <input
                            type="number" step="0.01" value={r.remaining ?? ""}
                            onChange={(e) => updateRow(idx, "remaining", e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="text" value={r.unit ?? ""}
                            onChange={(e) => updateRow(idx, "unit", e.target.value)}
                            style={{ ...inputStyle, width: 60 }}
                          />
                        </td>
                        <td style={tdStyle}>
                          <input
                            type="number" step="0.01" value={r.price ?? ""}
                            onChange={(e) => updateRow(idx, "price", e.target.value)}
                            style={inputStyle}
                          />
                        </td>
                        <td style={tdStyle}>{r.category || "—"}</td>
                        <td style={tdStyle}>{r.supplier || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: SPACING.lg, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: COLORS.muted }}>On duplicate match:</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={{ padding: "6px 10px", fontSize: 12, borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text }}
              >
                <option value="insert_new_only">Insert new items only (skip existing)</option>
                <option value="update_existing">Update existing items</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Btn onClick={handleCommit} loading={loading} icon={<CheckCircle2 size={16} />} style={{ flex: 1 }}>
                Commit Import ({validCount} rows)
              </Btn>
              <Btn variant="ghost" onClick={() => setStep("pick")} style={{ border: `1px solid ${COLORS.border}`, flex: 1 }}>
                Back
            </Btn>
          </div>
        </>
        )}

        {step === "done" && result && (
          <>
            <div style={{
              background: "#ECFDF5", border: "1px solid #6EE7B7", color: "#047857",
              borderRadius: RADIUS.sm, padding: "12px 14px", fontSize: 13, marginBottom: SPACING.lg,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle2 size={18} /> {result.message}
            </div>
            {result.skippedReasons && result.skippedReasons.length > 0 && (
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: SPACING.lg, maxHeight: 160, overflowY: "auto" }}>
                <strong>Skipped rows:</strong>
                <ul style={{ margin: "6px 0 0 18px" }}>
                  {result.skippedReasons.map((s, i) => (
                    <li key={i}>Row {s.row}: {s.reason}</li>
                  ))}
                </ul>
              </div>
            )}
            <Btn onClick={handleClose} style={{ width: "100%" }}>Done</Btn>
          </>
        )}
      </div>
    </div>
  );
}

const thStyle = { textAlign: "left", padding: "8px 10px", fontSize: 11, color: COLORS.muted, fontWeight: 600, whiteSpace: "nowrap" };
const tdStyle = { padding: "6px 10px", color: COLORS.text, whiteSpace: "nowrap" };
const inputStyle = { width: 80, padding: "4px 6px", fontSize: 12, borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text };
