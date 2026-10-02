import { COLORS } from "../../styles/colors";
import { Loader2, Database, Layers, PackageCheck } from "lucide-react";

export default function StockSkeletonLoader() {
  return (
    <div style={{ padding: "20px 0" }}>
      {/* Telemetry pulse bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(30, 41, 59, 0.7)",
        border: "1px solid rgba(232, 168, 56, 0.3)",
        borderRadius: 8,
        padding: "12px 18px",
        marginBottom: 16,
        backdropFilter: "blur(8px)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Loader2 size={18} className="spin" style={{ color: "var(--color-gold)" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main)", letterSpacing: "0.02em" }}>
            Synchronizing Warehouse Inventory & Rack Allocations…
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Database size={13} style={{ color: "var(--color-info)" }} /> 366 Active SKUs
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Layers size={13} style={{ color: "#4ade80" }} /> Multi-Batch FEFO
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <PackageCheck size={13} style={{ color: "#f59e0b" }} /> Real-Time Racks
          </span>
        </div>
      </div>

      {/* Table skeleton rows */}
      <div style={{
        background: "rgba(15, 23, 42, 0.6)",
        border: "1px solid var(--border-color)",
        borderRadius: 10,
        overflow: "hidden"
      }}>
        {/* Skeleton Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "100px 2fr 1.2fr 1.4fr 1.2fr 1fr 1.2fr 1.5fr 1.4fr 160px",
          gap: 12,
          padding: "14px 16px",
          background: "rgba(30, 41, 59, 0.8)",
          borderBottom: "1px solid var(--border-color)"
        }}>
          {["SKU", "ITEM DESCRIPTION", "CATEGORY", "RACK POSITION", "STOCK LEVEL", "UNIT", "VALUATION", "VENDOR", "ENTRY TIME", "ACTIONS"].map((h, i) => (
            <div key={i} style={{ height: 12, background: "var(--border-color)", borderRadius: 4 }} />
          ))}
        </div>

        {/* Skeleton Body Rows */}
        {[...Array(8)].map((_, rIdx) => (
          <div key={rIdx} style={{
            display: "grid",
            gridTemplateColumns: "100px 2fr 1.2fr 1.4fr 1.2fr 1fr 1.2fr 1.5fr 1.4fr 160px",
            gap: 12,
            padding: "16px",
            borderBottom: "1px solid var(--border-color)",
            alignItems: "center",
            opacity: 1 - (rIdx * 0.1)
          }}>
            <div style={{ height: 16, width: 70, background: "rgba(232, 168, 56, 0.2)", borderRadius: 4 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ height: 14, width: "85%", background: "var(--border-color)", borderRadius: 4 }} />
              <div style={{ height: 10, width: "50%", background: "var(--border-color)", borderRadius: 3 }} />
            </div>
            <div style={{ height: 18, width: 80, background: "rgba(56, 189, 248, 0.15)", borderRadius: 12 }} />
            <div style={{ height: 18, width: 110, background: "rgba(168, 85, 247, 0.15)", borderRadius: 12 }} />
            <div style={{ height: 18, width: 75, background: "rgba(74, 222, 128, 0.2)", borderRadius: 12 }} />
            <div style={{ height: 14, width: 35, background: "var(--border-color)", borderRadius: 4 }} />
            <div style={{ height: 14, width: 70, background: "var(--border-color)", borderRadius: 4 }} />
            <div style={{ height: 14, width: 100, background: "var(--border-color)", borderRadius: 4 }} />
            <div style={{ height: 14, width: 95, background: "var(--border-color)", borderRadius: 4 }} />
            <div style={{ display: "flex", gap: 6 }}>
              {[1, 2, 3, 4].map(btn => (
                <div key={btn} style={{ height: 26, width: 26, background: "var(--border-color)", borderRadius: 4 }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
