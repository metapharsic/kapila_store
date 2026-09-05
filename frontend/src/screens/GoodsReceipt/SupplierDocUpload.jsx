import { useState, useRef } from "react";
import Btn from "../../components/Btn";
import { COLORS, UNITS } from "../../styles/colors";
import * as api from "../../api";
import { useAppContext } from "../../context/AppContext";

// ── Icons (inline SVG to avoid extra deps) ────────────────────────────────
const UploadIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);
const WarnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>
  </svg>
);

// ── Stage machine: idle → scanning → review → saving → done ──────────────
const STAGE = { IDLE: "idle", SCANNING: "scanning", REVIEW: "review", SAVING: "saving", DONE: "done" };

export default function SupplierDocUpload({ supplierList, onSuccess, onClose }) {
  const { refreshStockNames } = useAppContext();
  const fileRef = useRef(null);
  const dropRef = useRef(null);

  const [stage, setStage]         = useState(STAGE.IDLE);
  const [selectedFile, setFile]   = useState(null);
  const [supplierId, setSupplierId] = useState("");
  const [isDragging, setDragging] = useState(false);
  const [error, setError]         = useState("");

  // Review state
  const [preview, setPreview]     = useState(null); // { supplier, date, invoice_no, items }
  const [reviewItems, setReview]  = useState([]);
  const [header, setHeader]       = useState({ date: "", invoice_no: "", received_by: "" });

  // Done state
  const [result, setResult]       = useState(null); // { grn_number, items }

  // ── File selection ───────────────────────────────────────────────────────
  const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp";

  const handleFile = (file) => {
    if (!file) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Only PDF, JPG, PNG, or WEBP files are accepted.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("File is too large. Maximum size is 15 MB.");
      return;
    }
    setError("");
    setFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  // ── Scan ────────────────────────────────────────────────────────────────
  const runScan = async () => {
    if (!selectedFile)  return setError("Please select a file.");
    if (!supplierId)    return setError("Please select a supplier.");

    setError("");
    setStage(STAGE.SCANNING);

    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("supplier_id", supplierId);

      const res = await api.approvedDelivery.scan(fd);
      const data = res.data;

      setPreview(data);
      setHeader({
        date:        data.date || new Date().toISOString().slice(0, 10),
        invoice_no:  data.invoice_no || "",
        received_by: "",
      });
      setReview(
        data.items.map(it => ({
          ...it,
          landed_cost: it.landed_cost || ((it.qty || 0) * (it.unit_price || 0)).toFixed(2),
        }))
      );
      setStage(STAGE.REVIEW);
    } catch (err) {
      setError(err.message || "AI scan failed. Please try again.");
      setStage(STAGE.IDLE);
    }
  };

  // ── Review helpers ───────────────────────────────────────────────────────
  const updateItem = (idx, key, val) => {
    setReview(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: val };
      if (key === "qty" || key === "unit_price") {
        const q = key === "qty" ? parseFloat(val) : parseFloat(next[idx].qty);
        const p = key === "unit_price" ? parseFloat(val) : parseFloat(next[idx].unit_price);
        next[idx].landed_cost = ((q || 0) * (p || 0)).toFixed(2);
      }
      return next;
    });
  };

  const removeItem = (idx) => setReview(p => p.filter((_, i) => i !== idx));

  const addItem = () => setReview(p => [...p, { name: "", qty: "", unit: "kg", unit_price: "0", landed_cost: "0", item_code: "", stock_match: false }]);

  // ── Commit ───────────────────────────────────────────────────────────────
  const commitGRN = async () => {
    const validItems = reviewItems.filter(it => it.name && parseFloat(it.qty) > 0);
    if (validItems.length === 0) return setError("Please have at least one item with a valid quantity.");

    setError("");
    setStage(STAGE.SAVING);

    try {
      const res = await api.approvedDelivery.commit({
        supplier_id:  parseInt(supplierId),
        date:         header.date,
        invoice_no:   header.invoice_no || null,
        received_by:  header.received_by || null,
        remarks:      `Auto-created via AI document scan (${selectedFile?.name || "upload"})`,
        items: validItems.map(it => ({
          name:        it.name,
          qty:         parseFloat(it.qty),
          unit:        it.unit,
          unit_price:  parseFloat(it.unit_price) || 0,
          landed_cost: parseFloat(it.landed_cost) || 0,
          item_code:   it.item_code || "",
        })),
      });

      await refreshStockNames();
      setResult(res.data);
      setStage(STAGE.DONE);
      onSuccess && onSuccess(res.data);
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
      setStage(STAGE.REVIEW);
    }
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const overlayStyle = {
    position: "fixed", inset: 0, zIndex: 200,
    background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20,
  };
  const panelStyle = {
    background: COLORS.surface, borderRadius: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    width: "100%", maxWidth: 760,
    maxHeight: "90vh", overflowY: "auto",
    display: "flex", flexDirection: "column",
  };
  const headerStyle = {
    padding: "20px 24px 16px",
    borderBottom: `1px solid ${COLORS.border}`,
    display: "flex", justifyContent: "space-between", alignItems: "center",
  };
  const bodyStyle = { padding: "24px" };

  const labelStyle = {
    fontSize: 11, color: COLORS.muted,
    textTransform: "uppercase", letterSpacing: "0.06em",
    display: "block", marginBottom: 6, fontWeight: 600,
  };

  const inputStyle = {
    width: "100%", padding: "9px 12px",
    background: COLORS.bg, border: `1px solid ${COLORS.border}`,
    color: COLORS.text, borderRadius: 8, fontSize: 13,
  };

  const grandTotal = reviewItems.reduce((s, it) => s + (parseFloat(it.landed_cost) || 0), 0);

  // ── Renders ──────────────────────────────────────────────────────────────
  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panelStyle}>

        {/* HEADER */}
        <div style={headerStyle}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>Upload Supplier Delivery Document</p>
            <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
              Upload a PDF challan or photo — AI will extract items and update your stock
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: COLORS.muted, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={bodyStyle}>

          {/* ── DONE STATE ───────────────────────────────────────────────── */}
          {stage === STAGE.DONE && result && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${COLORS.success}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={COLORS.success} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <p style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>Stock Updated Successfully!</p>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 4 }}>
                GRN created: <span style={{ fontFamily: "monospace", fontWeight: 600, color: COLORS.teal }}>{result.grn_number}</span>
              </p>
              <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 24 }}>
                {result.items?.length || 0} item(s) added to inventory
              </p>
              {result.items && result.items.length > 0 && (
                <div style={{ background: COLORS.bg, borderRadius: 10, padding: 16, textAlign: "left", marginBottom: 20 }}>
                  {result.items.map((it, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < result.items.length - 1 ? `1px solid ${COLORS.border}22` : "none", fontSize: 13 }}>
                      <span style={{ fontWeight: 500, color: COLORS.text }}>{it.name}</span>
                      <span style={{ color: COLORS.muted }}>{it.qty_accepted} {it.unit}</span>
                    </div>
                  ))}
                </div>
              )}
              <Btn onClick={onClose}>Close</Btn>
            </div>
          )}

          {/* ── IDLE / SCANNING STATE ────────────────────────────────────── */}
          {(stage === STAGE.IDLE || stage === STAGE.SCANNING) && (
            <>
              {/* Supplier selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Supplier *</label>
                <select
                  value={supplierId}
                  onChange={e => { setSupplierId(e.target.value); setError(""); }}
                  style={inputStyle}
                  disabled={stage === STAGE.SCANNING}
                >
                  <option value="">— Select a Supplier —</option>
                  {supplierList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Drop zone */}
              <div
                ref={dropRef}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => stage !== STAGE.SCANNING && fileRef.current.click()}
                style={{
                  border: `2px dashed ${isDragging ? COLORS.brand : selectedFile ? COLORS.success : COLORS.border}`,
                  borderRadius: 12,
                  padding: "36px 24px",
                  textAlign: "center",
                  cursor: stage === STAGE.SCANNING ? "not-allowed" : "pointer",
                  background: isDragging ? `${COLORS.brandLight}` : selectedFile ? `${COLORS.success}08` : COLORS.bg,
                  transition: "all 0.2s",
                  marginBottom: 20,
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept={ACCEPT}
                  style={{ display: "none" }}
                  onChange={e => handleFile(e.target.files[0])}
                />

                {stage === STAGE.SCANNING ? (
                  <>
                    <div style={{ width: 48, height: 48, border: `4px solid ${COLORS.brand}`, borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p style={{ color: COLORS.brand, fontWeight: 600, fontSize: 15 }}>AI is reading your document…</p>
                    <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>Extracting items, quantities, and invoice details</p>
                  </>
                ) : selectedFile ? (
                  <>
                    <div style={{ color: COLORS.success, marginBottom: 10 }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13l-4 4-4-4M12 17V9"/></svg>
                    </div>
                    <p style={{ color: COLORS.text, fontWeight: 600 }}>{selectedFile.name}</p>
                    <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>
                      {(selectedFile.size / 1024).toFixed(0)} KB · {selectedFile.type.includes("pdf") ? "PDF Document" : "Image"}
                    </p>
                    <p style={{ color: COLORS.brand, fontSize: 12, marginTop: 8 }}>Click to change file</p>
                  </>
                ) : (
                  <>
                    <div style={{ color: COLORS.muted, marginBottom: 12 }}><UploadIcon /></div>
                    <p style={{ color: COLORS.text, fontWeight: 600, fontSize: 14 }}>Drag & drop or click to upload</p>
                    <p style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>
                      Supports PDF delivery challans, scanned invoices, or photos of paper documents
                    </p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                      {["PDF", "JPG", "PNG", "WEBP"].map(ext => (
                        <span key={ext} style={{ background: COLORS.border, color: COLORS.muted, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{ext}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {error && (
                <p style={{ color: COLORS.danger, fontSize: 12, background: `${COLORS.danger}10`, padding: "8px 12px", borderRadius: 8, marginBottom: 16 }}>
                  ⚠ {error}
                </p>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <Btn
                  onClick={runScan}
                  disabled={!selectedFile || !supplierId || stage === STAGE.SCANNING}
                  style={{ flex: 1 }}
                >
                  {stage === STAGE.SCANNING ? "Scanning…" : "Scan Document with AI"}
                </Btn>
                <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
              </div>
            </>
          )}

          {/* ── REVIEW STATE ──────────────────────────────────────────────── */}
          {(stage === STAGE.REVIEW || stage === STAGE.SAVING) && preview && (
            <>
              {/* Stats banner */}
              <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                <div style={{ flex: 1, background: `${COLORS.success}10`, border: `1px solid ${COLORS.success}33`, borderRadius: 10, padding: "12px 16px" }}>
                  <p style={{ fontSize: 11, color: COLORS.success, fontWeight: 600, textTransform: "uppercase" }}>✓ Items Extracted</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, marginTop: 2 }}>{reviewItems.length}</p>
                </div>
                <div style={{ flex: 1, background: `${COLORS.brand}08`, border: `1px solid ${COLORS.brand}22`, borderRadius: 10, padding: "12px 16px" }}>
                  <p style={{ fontSize: 11, color: COLORS.brand, fontWeight: 600, textTransform: "uppercase" }}>Stock Matches</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, marginTop: 2 }}>
                    {reviewItems.filter(it => it.stock_match).length}/{reviewItems.length}
                  </p>
                </div>
                <div style={{ flex: 1, background: `${COLORS.muted}10`, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px" }}>
                  <p style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase" }}>Landed Total</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: COLORS.brand, marginTop: 2 }}>
                    ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Header fields */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={labelStyle}>Delivery Date</label>
                  <input type="date" value={header.date} onChange={e => setHeader(h => ({ ...h, date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Invoice / Challan No</label>
                  <input value={header.invoice_no} onChange={e => setHeader(h => ({ ...h, invoice_no: e.target.value }))} placeholder="INV-12345" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Received By</label>
                  <input value={header.received_by} onChange={e => setHeader(h => ({ ...h, received_by: e.target.value }))} placeholder="Storekeeper name" style={inputStyle} />
                </div>
              </div>

              {/* Items table */}
              <p style={{ fontSize: 11, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10, fontWeight: 600 }}>
                Review & Edit Extracted Items
              </p>
              <p style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
                <span style={{ color: COLORS.success }}>✓ Green</span> = matched to existing stock · <span style={{ color: COLORS.warning }}>⚠ Amber</span> = new item (will be created) · All fields are editable.
              </p>

              <div className="resp-table-wrap" style={{ marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      {["", "Item Name", "Qty", "Unit", "Unit Price (₹)", "Landed Cost", ""].map((h, i) => (
                        <th key={i} style={{ padding: "8px 10px", textAlign: "left", color: COLORS.muted, fontWeight: 500, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reviewItems.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${COLORS.border}22` }}>
                        {/* Match badge */}
                        <td style={{ padding: "8px 6px" }}>
                          {it.stock_match ? (
                            <span title="Matched to existing stock" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: `${COLORS.success}20`, color: COLORS.success }}>
                              <CheckIcon />
                            </span>
                          ) : (
                            <span title="New item — will be created in stock" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: `${COLORS.warning}20`, color: COLORS.warning }}>
                              <WarnIcon />
                            </span>
                          )}
                        </td>
                        {/* Name */}
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            value={it.name}
                            onChange={e => updateItem(idx, "name", e.target.value)}
                            style={{ ...inputStyle, width: 170, padding: "6px 8px" }}
                          />
                        </td>
                        {/* Qty */}
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number" min="0" step="any"
                            value={it.qty}
                            onChange={e => updateItem(idx, "qty", e.target.value)}
                            style={{ ...inputStyle, width: 80, padding: "6px 8px" }}
                          />
                        </td>
                        {/* Unit */}
                        <td style={{ padding: "6px 8px" }}>
                          <select
                            value={it.unit}
                            onChange={e => updateItem(idx, "unit", e.target.value)}
                            style={{ ...inputStyle, width: 80, padding: "6px 8px" }}
                          >
                            {UNITS.map(u => <option key={u}>{u}</option>)}
                          </select>
                        </td>
                        {/* Unit Price */}
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number" min="0" step="any"
                            value={it.unit_price}
                            onChange={e => updateItem(idx, "unit_price", e.target.value)}
                            style={{ ...inputStyle, width: 100, padding: "6px 8px" }}
                          />
                        </td>
                        {/* Landed cost */}
                        <td style={{ padding: "6px 12px", color: COLORS.brand, fontWeight: 600, whiteSpace: "nowrap" }}>
                          ₹{parseFloat(it.landed_cost || 0).toFixed(2)}
                        </td>
                        {/* Remove */}
                        <td style={{ padding: "6px 6px" }}>
                          {reviewItems.length > 1 && (
                            <button
                              onClick={() => removeItem(idx)}
                              style={{ background: `${COLORS.danger}15`, border: "none", color: COLORS.danger, borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
                            >×</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ padding: "10px 10px", textAlign: "right", color: COLORS.muted, fontWeight: 600, fontSize: 12, textTransform: "uppercase" }}>
                        Grand Total
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 700, color: COLORS.brand, fontSize: 15 }}>
                        ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <button
                onClick={addItem}
                style={{ background: "none", border: `1px dashed ${COLORS.border}`, borderRadius: 8, padding: "8px 16px", color: COLORS.muted, fontSize: 12, cursor: "pointer", marginBottom: 20, width: "100%" }}
              >
                + Add Missing Item
              </button>

              {error && (
                <p style={{ color: COLORS.danger, fontSize: 12, background: `${COLORS.danger}10`, padding: "8px 12px", borderRadius: 8, marginBottom: 16 }}>
                  ⚠ {error}
                </p>
              )}

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <Btn
                  onClick={commitGRN}
                  disabled={stage === STAGE.SAVING}
                  loading={stage === STAGE.SAVING}
                  style={{ flex: 1 }}
                >
                  {stage === STAGE.SAVING ? "Saving…" : `Confirm & Update Stock (${reviewItems.filter(it => it.name && parseFloat(it.qty) > 0).length} items)`}
                </Btn>
                <Btn variant="ghost" onClick={() => { setStage(STAGE.IDLE); setError(""); }}>← Re-upload</Btn>
                <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
