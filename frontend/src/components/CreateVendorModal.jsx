import { useState } from "react";
import { X, Building2, Phone, Mail, FileText, MapPin, CheckCircle, AlertCircle } from "lucide-react";
import * as api from "../api";
import Btn from "./Btn";
import Input from "./Input";
import { COLORS } from "../styles/colors";

const initialForm = {
  name: "",
  contact_name: "",
  phone: "",
  email: "",
  gstin: "",
  address: "",
};

export default function CreateVendorModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!open) return null;

  const set = (k, v) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) {
      setError("Vendor / Business Name is required.");
      return;
    }

    if (form.phone && !/^[0-9+ -]{7,15}$/.test(form.phone.trim())) {
      setError("Please enter a valid phone number.");
      return;
    }

    if (form.gstin && form.gstin.trim().length > 0 && form.gstin.trim().length < 15) {
      setError("GSTIN format typically consists of 15 alphanumeric characters.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        gstin: form.gstin.trim().toUpperCase() || null,
        address: form.address.trim() || null,
      };

      const res = await api.suppliers.create(payload);
      const created = res.data || res;
      setSuccessMsg(`Vendor "${form.name}" registered successfully ✓`);
      setForm(initialForm);
      
      setTimeout(() => {
        setSuccessMsg("");
        if (onSuccess) onSuccess(created);
        onClose();
      }, 900);
    } catch (err) {
      setError(err.message || "Failed to create vendor. Check details and retry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(17, 17, 19, 0.65)",
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
          backgroundColor: "var(--bg-card, #ffffff)",
          borderRadius: "var(--radius-lg, 16px)",
          width: "100%",
          maxWidth: 540,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--border-color)",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            backgroundColor: "var(--bg-sidebar, #111113)",
            color: "var(--text-sidebar, #f4f4f5)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid var(--sidebar-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: "var(--color-gold-dim)",
                color: "var(--color-gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#ffffff" }}>
                Add New Vendor / Supplier
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-sidebar-muted)" }}>
                Register business, contact and GST details into Kapila IMS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-sidebar-muted)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
            }}
          >
            <X size={20} color="#ffffff" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: 8,
                color: "#991B1B",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertCircle size={16} flexShrink={0} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "#ECFDF5",
                border: "1px solid #86EFAC",
                borderRadius: 8,
                color: "#065F46",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CheckCircle size={16} flexShrink={0} />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main)", display: "block", marginBottom: 6 }}>
              Vendor / Business Name <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Hyderabad Fresh Farm Supplies"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "var(--radius-sm, 8px)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-page)",
                color: "var(--text-main)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main)", display: "block", marginBottom: 6 }}>
                Contact Person Name
              </label>
              <input
                type="text"
                value={form.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
                placeholder="e.g. Ramesh Reddy"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm, 8px)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-page)",
                  color: "var(--text-main)",
                  fontSize: 13.5,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main)", display: "block", marginBottom: 6 }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91 98765 43210"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm, 8px)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-page)",
                  color: "var(--text-main)",
                  fontSize: 13.5,
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main)", display: "block", marginBottom: 6 }}>
                GSTIN / Tax ID
              </label>
              <input
                type="text"
                maxLength={15}
                value={form.gstin}
                onChange={(e) => set("gstin", e.target.value)}
                placeholder="36AAAAA0000A1Z5"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm, 8px)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-page)",
                  color: "var(--text-main)",
                  fontSize: 13.5,
                  fontFamily: "monospace",
                  textTransform: "uppercase",
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main)", display: "block", marginBottom: 6 }}>
                Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="orders@vendor.com"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm, 8px)",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-page)",
                  color: "var(--text-main)",
                  fontSize: 13.5,
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main)", display: "block", marginBottom: 6 }}>
              Warehouse / Billing Address
            </label>
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Shop #4, Wholesale Market, Secunderabad"
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm, 8px)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-page)",
                color: "var(--text-main)",
                fontSize: 13,
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 10,
              paddingTop: 16,
              borderTop: "1px solid var(--border-color)",
            }}
          >
            <Btn variant="ghost" onClick={onClose} disabled={saving} style={{ border: "1px solid var(--border-color)" }}>
              Cancel
            </Btn>
            <Btn
              type="submit"
              disabled={saving || !form.name.trim()}
              style={{
                backgroundColor: "var(--color-gold)",
                borderColor: "var(--color-gold)",
                color: "#18181b",
                fontWeight: 700,
                minWidth: 140,
              }}
            >
              {saving ? "Registering..." : "Save Vendor ✓"}
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
