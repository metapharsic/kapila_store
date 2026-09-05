import React from "react";
import Card from "../../components/Card";
import { Banknote, PackageOpen, AlertTriangle } from "lucide-react";
import { COLORS } from "../../styles/colors";

const StockStats = ({ stats, filters, handleStatCardClick }) => {
  const isTotalActive = filters.low_stock === "" && filters.active_only === "";
  const isActiveActive = filters.active_only === "true";
  const isLowActive = filters.low_stock === "true";

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
      {[
        { id: "total", label: "Total Active Spend", value: stats.total_spend, color: COLORS.teal, icon: <Banknote size={20} /> },
        { id: "active", label: "Current Store Value", value: stats.store_value, color: COLORS.accent, icon: <PackageOpen size={20} /> },
        { id: "low", label: "Low Stock Value", value: stats.low_stock_value, color: COLORS.danger, icon: <AlertTriangle size={20} /> }
      ].map((kpi) => {
        const isActive = (kpi.id === "total" && isTotalActive) || (kpi.id === "active" && isActiveActive) || (kpi.id === "low" && isLowActive);
        return (
          <Card
            key={kpi.id}
            onClick={() => handleStatCardClick(kpi.id)}
            style={{
              flex: 1,
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              border: `1px solid ${COLORS.border}`,
              borderTop: isActive ? `3px solid ${kpi.color}` : `1px solid ${COLORS.border}`,
              boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
              transform: isActive ? "translateY(-1px)" : "none",
              paddingTop: isActive ? "12px" : "14px"
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40, borderRadius: 8,
              background: kpi.color + "15", color: kpi.color,
              flexShrink: 0
            }}>
              {kpi.icon}
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 500, color: COLORS.muted, marginBottom: 2 }}>{kpi.label}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: COLORS.text, lineHeight: 1.1 }}>₹{parseFloat(kpi.value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default StockStats;
