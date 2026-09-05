import React from "react";
import Card from "../Card";
import { Banknote, PackageOpen, AlertTriangle } from "lucide-react";
import { COLORS } from "../../styles/colors";

export function StockKpiCards({ data = {}, filters = {}, handleStatCardClick = () => {}, isMobile = false }) {
  const isTotalActive = filters.low_stock === "" && filters.active_only === "";
  const isActiveActive = filters.active_only === "true";
  const isLowActive = filters.low_stock === "true";

  const kpis = [
    { id: "total", label: "Total Active Spend", value: data.total_spend ?? data.totalActiveSpend ?? 0, color: COLORS.teal, icon: <Banknote size={isMobile ? 16 : 20} /> },
    { id: "active", label: "Current Store Value", value: data.store_value ?? data.currentStoreValue ?? 0, color: COLORS.accent, icon: <PackageOpen size={isMobile ? 16 : 20} /> },
    { id: "low", label: "Low Stock Value", value: data.low_stock_value ?? data.lowStockValue ?? 0, color: COLORS.danger, icon: <AlertTriangle size={isMobile ? 16 : 20} /> }
  ];

  return (
    <div className="resp-grid-3 kpi-row" style={{ marginBottom: 14 }}>
      {kpis.map((kpi) => {
        const isActive = (kpi.id === "total" && isTotalActive) || (kpi.id === "active" && isActiveActive) || (kpi.id === "low" && isLowActive);
        return (
          <Card
            key={kpi.id}
            onClick={() => handleStatCardClick(kpi.id)}
            style={{
              flex: 1,
              padding: isMobile ? "10px 14px" : "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 10 : 14,
              cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              border: `1px solid ${COLORS.border}`,
              borderTop: isActive ? `3px solid ${kpi.color}` : `1px solid ${COLORS.border}`,
              boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.06)" : "none",
              transform: isActive ? "translateY(-1px)" : "none",
              paddingTop: isActive ? (isMobile ? "8px" : "12px") : (isMobile ? "10px" : "14px"),
            }}
          >
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: isMobile ? 32 : 40,
              height: isMobile ? 32 : 40,
              borderRadius: 8,
              background: kpi.color + "15", color: kpi.color,
              flexShrink: 0
            }}>
              {kpi.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: isMobile ? 10 : 12, fontWeight: 500, color: COLORS.muted, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {kpi.label}
              </p>
              <p style={{ fontSize: isMobile ? 16 : 24, fontWeight: 700, color: COLORS.text, lineHeight: 1.1 }}>
                ₹{parseFloat(kpi.value || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
