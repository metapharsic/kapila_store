import React from "react";
import { COLORS } from "../../styles/colors";
import { AlertOctagon, ClipboardList, Send, TrendingDown, CheckCircle, ShoppingCart, Clock } from "lucide-react";
import Btn from "../../components/Btn";
import Card from "../../components/Card";
import { today } from "../../utils/dates";

const StoreAlertsPanel = ({
  lowStockItems,
  expiringSoonItems,
  copyPOToClipboard,
  generateWhatsAppPO,
  handleReorderClick,
  getInitialsAvatar
}) => {
  return (
    <Card style={{ padding: 16 }}>
      {/* Header / Global Action */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, borderBottom: `1px solid ${COLORS.border}55`, paddingBottom: 10 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertOctagon size={16} style={{ color: COLORS.danger }} /> Store Alerts
          </p>
          <p style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>Auto-evaluated warnings</p>
        </div>
        {lowStockItems.length > 0 && (
          <div style={{ display: "flex", gap: 4 }}>
            <Btn variant="ghost" small onClick={copyPOToClipboard} icon={<ClipboardList size={12} />} style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${COLORS.border}` }} title="Copy Purchase Order to Clipboard">
              Copy PO
            </Btn>
            <Btn variant="ghost" small onClick={generateWhatsAppPO} icon={<Send size={12} />} style={{ fontSize: 11, padding: "4px 8px", background: "#25D36622", border: "1px solid #25D36644", color: "#25D366" }} title="Send Purchase Order to WhatsApp">
              Send PO
            </Btn>
          </div>
        )}
      </div>

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
                <Btn variant="ghost" small onClick={() => handleReorderClick(item)} icon={<ShoppingCart size={12} />} title="Reorder" style={{ padding: "6px 8px" }} />
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
    </Card>
  );
};

export default StoreAlertsPanel;
