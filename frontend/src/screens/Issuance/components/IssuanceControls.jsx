import Card from "../../../components/Card";
import Btn from "../../../components/Btn";
import { COLORS } from "../../../styles/colors";
import { ChevronDown } from "lucide-react";

export default function IssuanceControls({ pendingIndents, selected, onSelect, onIssue }) {
  
  const formatIndentLabel = (indent) => {
    const dept = indent.dept;
    const date = new Date(indent.date).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    return `${dept} · ${date}`;
  };

  const sufficientCount = selected?.items?.filter(it => !it.isInsufficient).length || 0;
  const insufficientCount = selected?.items?.filter(it => it.isInsufficient).length || 0;

  return (
    <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Issue From Pending Indent
      </p>

      {pendingIndents.length === 0 ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: COLORS.muted, textAlign: "center" }}>No pending indents</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, display: "block", marginBottom: 6 }}>
              Select Indent
            </label>
            <div style={{ position: "relative" }}>
              <select 
                value={selected?.id || ""} 
                onChange={(e) => {
                  const ind = pendingIndents.find((i) => i.id === parseInt(e.target.value));
                  onSelect(ind || null);
                }}
                style={{ 
                  width: "100%", 
                  padding: "8px 32px 8px 12px", 
                  borderRadius: 6, 
                  border: `1px solid #e2e8f0`, 
                  appearance: "none",
                  backgroundColor: "#ffffff",
                  fontSize: 13,
                  color: COLORS.text,
                  outline: "none"
                }}
              >
                <option value="">-- Choose --</option>
                {pendingIndents.map((i) => (
                  <option key={i.id} value={i.id}>{formatIndentLabel(i)}</option>
                ))}
              </select>
              <ChevronDown size={14} color="#64748b" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
          </div>

          {selected && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ backgroundColor: "#f8fafc", border: `1px solid #e2e8f0`, borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Department</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{selected.dept}</div>
                </div>
                
                <div style={{ backgroundColor: "#f8fafc", border: `1px solid #e2e8f0`, borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Date Needed</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
                    {new Date(selected.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <div style={{ backgroundColor: "#f8fafc", border: `1px solid #e2e8f0`, borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Items</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{selected.items?.length || 0} items requested</div>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 12, color: COLORS.text, fontWeight: 500, marginBottom: 8 }}>Stock Summary:</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ backgroundColor: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                    ✅ {sufficientCount} sufficient
                  </span>
                  {insufficientCount > 0 && (
                    <span style={{ backgroundColor: "#fee2e2", color: "#dc2626", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                      ⚠️ {insufficientCount} insufficient
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: "auto" }}>
            <div style={{ height: 1, backgroundColor: "#e2e8f0", margin: "16px 0" }} />
            <button 
              onClick={onIssue}
              disabled={!selected}
              style={{ 
                width: "100%", 
                height: 44, 
                backgroundColor: selected ? "#1a1a2e" : "#cbd5e1", 
                color: "#ffffff", 
                border: "none", 
                borderRadius: 8, 
                fontSize: 14, 
                fontWeight: 600, 
                cursor: selected ? "pointer" : "not-allowed",
                transition: "background-color 0.2s"
              }}
            >
              Issue & Update Stock
            </button>
          </div>
        </>
      )}
    </Card>
  );
}
