import { useState } from "react";
import Btn from "../Btn";
import * as api from "../../api";
import { X, PlusCircle, Calendar, Clock, DollarSign, Building2, MapPin, Tag } from "lucide-react";
import { today } from "../../utils/dates";

export default function AppendBatchModal({
  isOpen,
  onClose,
  item,
  onSuccess
}) {
  if (!isOpen || !item) return null;

  const [qty, setQty] = useState("");
  const [price, setPrice] = useState(item.price ? String(item.price) : "");
  const [supplier, setSupplier] = useState(item.supplier || "");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [batchNo, setBatchNo] = useState(`BAT-${item.item_code}-${Date.now().toString().slice(-4)}`);
  const [expiryDate, setExpiryDate] = useState("");
  const [rackLocation, setRackLocation] = useState(item.rack_location || "Rack A-01 / Shelf 1");
  const [storageZone, setStorageZone] = useState(item.storage_zone || "Main Dry Store");
  const [date, setDate] = useState(today());
  const [purchaseTime, setPurchaseTime] = useState(new Date().toISOString().slice(0, 16));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!qty || parseFloat(qty) <= 0) {
      setError("Please enter a valid received quantity.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        qty: parseFloat(qty),
        price: parseFloat(price) || 0,
        supplier: supplier.trim() || item.supplier || "Direct Vendor",
        invoice_no: invoiceNo.trim() || `INV-${Date.now().toString().slice(-6)}`,
        batch_no: batchNo.trim() || `BAT-${item.item_code}-${Date.now().toString().slice(-4)}`,
        expiry_date: expiryDate || null,
        rack_location: rackLocation.trim(),
        storage_zone: storageZone.trim(),
        date,
        purchase_time: new Date(purchaseTime).toISOString(),
      };

      const res = await api.stock.appendBatch(item.id, payload);
      if (res && res.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setError(res.error || "Failed to append batch.");
      }
    } catch (err) {
      setError(err.message || "Error appending batch.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.75)",
      backdropFilter: "blur(6px)",
      zIndex: 1100,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: 16
    }}>
      <div style={{
        background: "var(--color-surface, var(--bg-card))",
        border: "1px solid rgba(232, 168, 56, 0.3)",
        borderRadius: 12,
        width: "100%",
        maxWidth: 580,
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8)"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(15, 23, 42, 0.7)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PlusCircle size={20} style={{ color: "var(--color-gold)" }} />
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-main)" }}>
                Append Stock-In / New Batch
              </h3>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {item.name} <span style={{ color: "var(--color-gold)", fontFamily: "monospace" }}>({item.item_code})</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{
              padding: 10,
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              borderRadius: 6,
              fontSize: 13
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Quantity Received * ({item.unit})
              </label>
              <input
                type="number"
                step="any"
                required
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="e.g. 25"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  color: "var(--text-main)",
                  fontSize: 14,
                  boxSizing: "border-box"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Unit Purchase Price (₹)
              </label>
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="₹ Rate per unit"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  color: "var(--text-main)",
                  fontSize: 14,
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Vendor / Supplier Name
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. City Wholesale Traders"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  color: "var(--text-main)",
                  fontSize: 14,
                  boxSizing: "border-box"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Invoice / Bill Reference
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="INV-2026-..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  color: "var(--text-main)",
                  fontSize: 14,
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Batch Identifier
              </label>
              <input
                type="text"
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  color: "var(--text-main)",
                  fontSize: 13,
                  fontFamily: "monospace",
                  boxSizing: "border-box"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Expiry Date (Optional)
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  color: "var(--text-main)",
                  fontSize: 14,
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Storage Zone
              </label>
              <input
                type="text"
                value={storageZone}
                onChange={(e) => setStorageZone(e.target.value)}
                placeholder="e.g. Main Dry Store"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  color: "var(--text-main)",
                  fontSize: 14,
                  boxSizing: "border-box"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Rack / Loading Coordinates
              </label>
              <input
                type="text"
                value={rackLocation}
                onChange={(e) => setRackLocation(e.target.value)}
                placeholder="Rack A-01 / Shelf 1"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  color: "var(--text-main)",
                  fontSize: 14,
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Receipt Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  color: "var(--text-main)",
                  fontSize: 14,
                  boxSizing: "border-box"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>
                Exact Time of Purchase / Entry
              </label>
              <input
                type="datetime-local"
                value={purchaseTime}
                onChange={(e) => setPurchaseTime(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  color: "var(--text-main)",
                  fontSize: 14,
                  boxSizing: "border-box"
                }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 8,
            paddingTop: 14,
            borderTop: "1px solid var(--border-color)"
          }}>
            <Btn variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Btn>
            <Btn variant="primary" icon={PlusCircle} type="submit" disabled={loading}>
              {loading ? "Appending Batch…" : "Confirm Inward & Append"}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
