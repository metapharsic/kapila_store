import React, { useState } from "react";
import { COLORS } from "../../styles/colors";
import { AlertOctagon, ClipboardList, Send, TrendingDown, CheckCircle, ShoppingCart, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import Btn from "../Btn";
import Card from "../Card";
import { today } from "../../utils/dates";

const StoreAlertsPanel = ({
  alerts,
  lowStockItems: propLowStockItems,
  expiringSoonItems: propExpiringSoonItems,
  copyPOToClipboard,
  generateWhatsAppPO,
  handleReorderClick,
  getInitialsAvatar: propGetInitialsAvatar,
  showActions = true,
  defaultCollapsed = true,
  style
}) => {
  // Support both passing alerts object or separate items arrays
  const lowStockItems = propLowStockItems ?? alerts?.lowStock ?? alerts?.lowStockItems ?? [];
  const expiringSoonItems = propExpiringSoonItems ?? alerts?.expiry ?? alerts?.expiringSoonItems ?? [];
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Default helper if not provided
  const getInitialsAvatar = propGetInitialsAvatar ?? ((name) => {
    if (!name) return { text: "??", bg: "#f1f5f9", fg: "#64748b" };
    const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, "");
    const parts = clean.split(/\s+/).filter(Boolean);
    let text = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : "ST");
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      { bg: "#eff6ff", fg: "#1d4ed8" },
      { bg: "#ecfdf5", fg: "#047857" },
      { bg: "#fef3c7", fg: "#b45309" },
      { bg: "#fff1f2", fg: "#be123c" },
      { bg: "#f5f3ff", fg: "#6d28d9" }
    ];
    return { text, ...colors[Math.abs(hash) % colors.length] };
  });

  return (
    <Card style={{ padding: isCollapsed ? "12px 16px" : 16, transition: "all 0.15s ease", ...style }}>
      {/* Header / Global Action */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: isCollapsed ? 0 : 14,
        borderBottom: isCollapsed ? "none" : `1px solid ${COLORS.border}55`,
        paddingBottom: isCollapsed ? 0 : 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertOctagon size={16} style={{ color: COLORS.danger }} /> Store Alerts
            </p>
            {!isCollapsed && <p style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>Auto-evaluated warnings</p>}
          </div>

          {/* Compact summary badges when collapsed */}
          {isCollapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {lowStockItems.length > 0 ? (
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: COLORS.danger + "15",
                  color: COLORS.danger,
                  padding: "2px 8px",
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}>
                  <TrendingDown size={12} /> {lowStockItems.length} Low Stock
                </span>
              ) : (
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: COLORS.success + "15",
                  color: COLORS.success,
                  padding: "2px 8px",
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}>
                  <CheckCircle size={12} /> Stock levels healthy
                </span>
              )}

              {expiringSoonItems.length > 0 ? (
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: COLORS.warning + "15",
                  color: COLORS.warning,
                  padding: "2px 8px",
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}>
                  <Clock size={12} /> {expiringSoonItems.length} Expiry Alerts
                </span>
              ) : (
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: COLORS.success + "15",
                  color: COLORS.success,
                  padding: "2px 8px",
                  borderRadius: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}>
                  <CheckCircle size={12} /> No near expiries
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {showActions && lowStockItems.length > 0 && !isCollapsed && (
            <div style={{ display: "flex", gap: 4 }}>
              <Btn variant="ghost" small onClick={copyPOToClipboard} icon={<ClipboardList size={12} />} style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${COLORS.border}` }} title="Copy Purchase Order to Clipboard">
                Copy PO
              </Btn>
              <Btn variant="ghost" small onClick={generateWhatsAppPO} icon={<Send size={12} />} style={{ fontSize: 11, padding: "4px 8px", background: "#25D36622", border: "1px solid #25D36644", color: "#25D366" }} title="Send Purchase Order to WhatsApp">
                Send PO
              </Btn>
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: "none",
              border: `1px solid ${COLORS.border}`,
              borderRadius: "6px",
              padding: "4px 8px",
              cursor: "pointer",
              color: COLORS.brand,
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontWeight: 600,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = COLORS.brandLight;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {isCollapsed ? "Expand" : "Collapse"}
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>

      {/* Section 1: Low Stock alerts */}
      <p style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <TrendingDown size={14} /> Low Stock Levels ({lowStockItems.length})
      </p>
      {lowStockItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "14px 0", background: COLORS.bg + "22", borderRadius: 6, marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: COLORS.success, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CheckCircle size={14} /> All levels healthy
          </p>
        </div>
      ) : (
        <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {lowStockItems.map((item) => {
            const pct = item.qty > 0 ? (item.remaining / item.qty) * 100 : 0;
            return (
              <div key={item.id} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                background: COLORS.bg + "55",
                border: `1px solid ${COLORS.border}44`,
                borderLeft: `3px solid ${COLORS.danger}`,
                borderRadius: 6
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden", flex: 1 }}>
                  {(() => {
                    const avatar = getInitialsAvatar(item.name);
                    return (
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: avatar.bg,
                        color: avatar.fg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 600,
                        flexShrink: 0
                      }}>
                        {avatar.text}
                      </div>
                    );
                  })()}
                  <div style={{ overflow: "hidden", lineHeight: 1.2 }}>
                    <span style={{ color: COLORS.accent, fontSize: 9, display: "block", fontWeight: 600 }}>{item.item_code}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", color: COLORS.text }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: COLORS.danger, display: "block", marginTop: 2, fontWeight: 500 }}>
                      {parseFloat(item.remaining).toFixed(1)} / {item.qty} {item.unit} ({pct.toFixed(0)}%)
                    </span>
                    <div style={{ height: 6, background: COLORS.border + "55", borderRadius: 3, overflow: "hidden", marginTop: 4, width: "100%", maxWidth: 150 }}>
                      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: COLORS.danger }} />
                    </div>
                  </div>
                </div>
                {showActions && (
                  <Btn variant="ghost" small onClick={() => handleReorderClick(item)} icon={<ShoppingCart size={12} />} title="Reorder" style={{ padding: "6px 8px" }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Section 2: Expiry warnings */}
      <p style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600, textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Clock size={14} /> Spoilage & Expiry Alerts ({expiringSoonItems.length})
      </p>
      {expiringSoonItems.length === 0 ? (
        <div style={{ textAlign: "center", padding: "14px 0", background: COLORS.bg + "22", borderRadius: 6 }}>
          <p style={{ fontSize: 11, color: COLORS.success, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CheckCircle size={14} /> No near expiries
          </p>
        </div>
      ) : (
        <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {expiringSoonItems.map((item) => {
            const todayVal = new Date(today());
            const expiryVal = new Date(item.expiry_date);
            const diffTime = expiryVal - todayVal;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return (
              <div key={item.id} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 14px",
                background: COLORS.bg + "55",
                border: `1px solid ${COLORS.border}44`,
                borderLeft: `3px solid ${COLORS.warning}`,
                borderRadius: 6
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden", flex: 1 }}>
                  {(() => {
                    const avatar = getInitialsAvatar(item.name);
                    return (
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: avatar.bg,
                        color: avatar.fg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 600,
                        flexShrink: 0
                      }}>
                        {avatar.text}
                      </div>
                    );
                  })()}
                  <div style={{ overflow: "hidden", lineHeight: 1.2 }}>
                    <span style={{ color: COLORS.accent, fontSize: 9, display: "block", fontWeight: 600 }}>{item.item_code}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", color: COLORS.text }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: COLORS.danger, display: "block", marginTop: 2, fontWeight: 500 }}>
                      {item.remaining} {item.unit} remaining
                    </span>
                    <div style={{ height: 6, background: COLORS.border + "55", borderRadius: 3, overflow: "hidden", marginTop: 4, width: "100%", maxWidth: 150 }}>
                      <div style={{ height: "100%", width: diffDays <= 0 ? "100%" : `${Math.max(10, 100 - (diffDays * 10))}%`, background: COLORS.danger }} />
                    </div>
                  </div>
                </div>
                <span className="status-badge" style={{ background: "var(--color-accent-red-light)", color: "var(--color-accent-red)", fontSize: 10, padding: "2px 6px" }}>
                  {diffDays <= 0 ? "Expired" : `${diffDays} days`}
                </span>
              </div>
            );
          })}
        </div>
      )}
        </>
      )}
    </Card>
  );
};

export default StoreAlertsPanel;
