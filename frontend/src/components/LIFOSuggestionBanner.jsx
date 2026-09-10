import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Receipt, 
  Calendar, 
  DollarSign, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldCheck,
  PackageCheck
} from "lucide-react";
import * as api from "../api";
import Btn from "./Btn";

export default function LIFOSuggestionBanner({
  itemCode,
  itemName,
  onSelectBatch,
  selectedBatchId = null,
  compact = false,
  style = {},
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [showAllBatches, setShowAllBatches] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!itemCode && !itemName) {
      setData(null);
      return;
    }

    let mounted = true;
    const fetchLIFO = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.stock.lifoSuggestions({ 
          item_code: itemCode || undefined, 
          name: itemName || undefined 
        });
        if (mounted) {
          setData(res);
          // If a candidate exists and none is selected yet, we can notify or auto-suggest
          if (res?.lifo_candidate && onSelectBatch && !selectedBatchId) {
            // Optional: let parent decide when to auto-select
          }
        }
      } catch (err) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLIFO();
    return () => {
      mounted = false;
    };
  }, [itemCode, itemName]);

  if (!itemCode && !itemName) return null;

  if (loading) {
    return (
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "var(--radius-md, 10px)",
          background: "rgba(244, 200, 75, 0.08)",
          border: "1px dashed rgba(244, 200, 75, 0.4)",
          color: "var(--text-muted)",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          ...style,
        }}
      >
        <TrendingUp size={14} className="spin-animate" color="var(--color-gold)" />
        <span>Evaluating available warehouse lots via LIFO Valuation Agent...</span>
      </div>
    );
  }

  if (error || !data || !data.batches || data.batches.length === 0) {
    return (
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "var(--radius-md, 10px)",
          background: "var(--bg-page)",
          border: "1px solid var(--border-color)",
          color: "var(--text-muted)",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          ...style,
        }}
      >
        <PackageCheck size={15} color="var(--text-muted)" />
        <span>
          <strong>LIFO Advisory:</strong> No active inward stock batches found for{" "}
          <em>{itemName || itemCode}</em>. Direct inward purchase required.
        </span>
      </div>
    );
  }

  const topBatch = data.lifo_candidate || data.batches[0];
  const isTopSelected = selectedBatchId ? selectedBatchId === topBatch.id : true;

  return (
    <div
      style={{
        borderRadius: "var(--radius-md, 12px)",
        border: "1.5px solid rgba(244, 200, 75, 0.5)",
        background: "var(--bg-card, #ffffff)",
        boxShadow: "0 4px 12px rgba(244, 200, 75, 0.08)",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Header with Store Manager Guidance Note */}
      <div
        style={{
          padding: compact ? "8px 12px" : "10px 16px",
          background: "rgba(244, 200, 75, 0.12)",
          borderBottom: "1px solid rgba(244, 200, 75, 0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "var(--color-gold)",
              color: "#18181b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: "#92400E" }}>
                Store Manager Guidance Note: Select LIFO Model
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: "#F59E0B",
                  color: "#ffffff",
                  padding: "1px 6px",
                  borderRadius: 4,
                }}
              >
                RECOMMENDED
              </span>
            </div>
            <p style={{ margin: "1px 0 0", fontSize: 11.5, color: "var(--text-main)" }}>
              Prioritize issuing/fetching the most recently purchased batch to reflect current market value and fresh inward stock.
            </p>
          </div>
        </div>

        {data.batches.length > 1 && (
          <button
            type="button"
            onClick={() => setShowAllBatches(!showAllBatches)}
            style={{
              background: "transparent",
              border: "none",
              color: "#B45309",
              fontSize: 11.5,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            <span>{data.batches.length} Available Batches</span>
            {showAllBatches ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Primary LIFO Recommended Batch Card */}
      <div style={{ padding: compact ? "10px 12px" : "14px 16px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
            background: "var(--bg-page)",
            padding: "12px",
            borderRadius: "var(--radius-sm, 8px)",
            border: "1px solid var(--border-color)",
          }}
        >
          {/* Invoice Purchased With */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)", fontSize: 11 }}>
              <Receipt size={13} color="#D97706" />
              <span>Purchase Invoice</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-main)", marginTop: 2 }}>
              #{topBatch.invoice_no}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              Batch: {topBatch.batch_no}
            </div>
          </div>

          {/* Item Age */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)", fontSize: 11 }}>
              <Calendar size={13} color="#2563EB" />
              <span>Batch Age</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#1E40AF", marginTop: 2 }}>
              {topBatch.age_days === 0 ? "0 Days (Today)" : `${topBatch.age_days} Days Old`}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              {topBatch.age_label}
            </div>
          </div>

          {/* Item Valuation */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)", fontSize: 11 }}>
              <DollarSign size={13} color="#059669" />
              <span>Cost & Lot Valuation</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#065F46", marginTop: 2 }}>
              ₹{topBatch.unit_cost.toFixed(2)} / {topBatch.unit}
            </div>
            <div style={{ fontSize: 10.5, color: "#047857", fontWeight: 600 }}>
              Lot: ₹{topBatch.lot_valuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({topBatch.remaining_qty} {topBatch.unit})
            </div>
          </div>

          {/* Supplier Info & Action */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-muted)", fontSize: 11 }}>
                <Building2 size={13} color="#7C3AED" />
                <span>Supplier</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-main)", marginTop: 2, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                {topBatch.supplier}
              </div>
            </div>

            {onSelectBatch && (
              <div style={{ marginTop: 6 }}>
                <Btn
                  type="button"
                  size="sm"
                  onClick={() => onSelectBatch(topBatch)}
                  style={{
                    width: "100%",
                    fontSize: 11,
                    padding: "4px 8px",
                    fontWeight: 700,
                    background: isTopSelected ? "#10B981" : "var(--color-gold)",
                    color: isTopSelected ? "#ffffff" : "#18181b",
                    borderColor: isTopSelected ? "#10B981" : "var(--color-gold)",
                  }}
                >
                  {isTopSelected ? "LIFO Batch Selected ✓" : "⚡ Select LIFO Batch"}
                </Btn>
              </div>
            )}
          </div>
        </div>

        {/* Note / Telemetry text */}
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={12} color="#D97706" />
          <span>
            {data.store_manager_note}
          </span>
        </div>

        {/* All Batches List (Expandable) */}
        {showAllBatches && data.batches.length > 1 && (
          <div style={{ marginTop: 12, borderTop: "1px solid var(--border-color)", paddingTop: 10 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>
              All Inventory Batches for {data.item_identifier} (Sorted by LIFO Order):
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.batches.map((b) => {
                const isSelected = selectedBatchId === b.id;
                return (
                  <div
                    key={b.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: b.is_lifo_candidate ? "rgba(244, 200, 75, 0.08)" : "var(--bg-page)",
                      border: isSelected 
                        ? "1.5px solid #10B981" 
                        : b.is_lifo_candidate 
                        ? "1px solid rgba(244, 200, 75, 0.4)" 
                        : "1px solid var(--border-color)",
                      fontSize: 11.5,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 10,
                          padding: "2px 5px",
                          borderRadius: 4,
                          background: b.is_lifo_candidate ? "var(--color-gold)" : "var(--bg-card)",
                          color: b.is_lifo_candidate ? "#18181b" : "var(--text-muted)",
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        #{b.lifo_rank} {b.is_lifo_candidate ? "LIFO" : ""}
                      </span>
                      <span>
                        <strong>Batch {b.batch_no}</strong> (Inv #{b.invoice_no})
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>•</span>
                      <span style={{ color: "#1E40AF" }}>{b.age_days}d old</span>
                      <span style={{ color: "var(--text-muted)" }}>•</span>
                      <span style={{ color: "#065F46", fontWeight: 600 }}>
                        ₹{b.unit_cost.toFixed(2)}/u (Lot: ₹{b.lot_valuation.toLocaleString("en-IN")})
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>•</span>
                      <span style={{ color: "var(--text-muted)" }}>Rem: {b.remaining_qty} {b.unit}</span>
                    </div>

                    {onSelectBatch && (
                      <button
                        type="button"
                        onClick={() => onSelectBatch(b)}
                        style={{
                          background: isSelected ? "#10B981" : "transparent",
                          color: isSelected ? "#ffffff" : "var(--text-main)",
                          border: "1px solid var(--border-color)",
                          padding: "3px 8px",
                          borderRadius: 4,
                          fontSize: 10.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {isSelected ? "Selected ✓" : "Select"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
