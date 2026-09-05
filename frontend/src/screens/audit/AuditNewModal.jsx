import { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { Clipboard, User, FileText, CheckCircle, XCircle } from "lucide-react";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import * as api from "../../api";
import { createAudit } from "./auditApi";

export default function AuditNewModal({ isOpen, onClose, onSuccess, user }) {
  const [reference, setReference] = useState("");
  const [auditorName, setAuditorName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [notes, setNotes] = useState("");
  const [depts, setDepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-generate reference on open
  useEffect(() => {
    if (isOpen) {
      const year = new Date().getFullYear();
      const rand = Math.floor(Math.random() * 900) + 100;
      setReference(`AUD-${year}-${rand}`);
      setAuditorName(user?.name || "");
      setDepartmentId("");
      setNotes("");
      setError("");

      // Fetch departments
      api.departments.list().then(res => {
        if (res.success) setDepts(res.data || []);
      }).catch(err => {
        console.error("Failed to fetch departments", err);
      });
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reference.trim()) return setError("Reference is required.");
    if (!auditorName.trim()) return setError("Auditor name is required.");

    setLoading(true);
    setError("");

    try {
      const payload = {
        reference: reference.trim(),
        auditor_name: auditorName.trim(),
        department_id: departmentId === "" ? null : parseInt(departmentId, 10),
        notes: notes.trim() === "" ? null : notes.trim(),
      };

      const res = await createAudit(payload);
      if (res.success) {
        onSuccess(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || "Failed to start audit session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(15, 23, 42, 0.65)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000,
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, padding: 24, width: 480, maxWidth: "90%",
        boxShadow: `0 8px 32px rgba(15, 23, 42, 0.15)`
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Clipboard size={18} color={COLORS.brand} /> Initiate Stock Audit
        </h3>

        {error && (
          <div style={{
            background: COLORS.danger + "11", border: `1px solid ${COLORS.danger}33`,
            borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
            fontSize: 13, color: COLORS.danger, marginBottom: 16
          }}>
            <XCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
            <Input 
              label="Audit Reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="AUD-YYYY-NNN"
              required
            />

            <Input 
              label="Auditor Name"
              value={auditorName}
              onChange={(e) => setAuditorName(e.target.value)}
              placeholder="Name of auditor"
              required
            />

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                Department Scope
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                style={{
                  width: "100%", padding: "8px 12px", fontSize: 13,
                  background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                  color: COLORS.text, borderRadius: 8
                }}
              >
                <option value="">All Departments (Global Central Store)</option>
                {depts.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                Audit Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional purpose, bounds or checklist items..."
                rows={3}
                style={{
                  width: "100%", padding: "8px 12px", fontSize: 13,
                  background: COLORS.bg, border: `1px solid ${COLORS.border}`,
                  color: COLORS.text, borderRadius: 8, resize: "vertical",
                  outline: "none"
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn 
              type="submit"
              disabled={loading || !reference.trim() || !auditorName.trim()}
              icon={<CheckCircle size={16} />}
              style={{ flex: 1 }}
            >
              {loading ? "Locking Snapshot..." : "Start Audit Session"}
            </Btn>
            <Btn 
              variant="ghost" 
              onClick={onClose} 
              type="button"
              style={{ border: `1px solid ${COLORS.border}`, flex: 1 }}
            >
              Cancel
            </Btn>
          </div>
        </form>
      </div>
    </div>
  );
}
