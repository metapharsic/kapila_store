import React, { useState, useEffect } from "react";
import { COLORS } from "../../styles/colors";
import { security } from "../../api";
import { 
  ShieldCheck, RefreshCw, Search, CheckCircle2, Clock, 
  AlertTriangle, ArrowDownLeft, ArrowUpRight, Flame, 
  Droplets, Package, X, Check, Eye, Download
} from "lucide-react";
import ReconcileRgpModal from "./ReconcileRgpModal";

export default function ReturnableAssetTracker() {
  const [loading, setLoading] = useState(false);
  const [passes, setPasses] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING"); // "PENDING" | "ALL" | "COMPLETED"
  const [assetTypeFilter, setAssetTypeFilter] = useState("ALL");
  const [selectedPassForRgp, setSelectedPassForRgp] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    loadRgpData();
  }, []);

  const loadRgpData = async () => {
    setLoading(true);
    try {
      const res = await security.listPasses({
        pass_type: "RGP_RETURNABLE",
        limit: 100
      });
      setPasses(res.rows || []);
    } catch (err) {
      console.error("Failed to load RGP passes:", err);
    } finally {
      setLoading(false);
    }
  };

  // Metrics computation
  let totalLpgOut = 0;
  let totalMilkCansOut = 0;
  let totalCratesOut = 0;
  let totalBanquetOut = 0;

  passes.forEach(p => {
    const due = parseInt(p.returnable_balance_due, 10) || 0;
    if (due <= 0) return;
    const itemType = (p.returnable_item_type || "").toLowerCase();
    if (itemType.includes("lpg") || itemType.includes("cylinder") || itemType.includes("gas")) {
      totalLpgOut += due;
    } else if (itemType.includes("can") || itemType.includes("milk") || itemType.includes("dairy")) {
      totalMilkCansOut += due;
    } else if (itemType.includes("crate") || itemType.includes("tray") || itemType.includes("box")) {
      totalCratesOut += due;
    } else {
      totalBanquetOut += due;
    }
  });

  const filteredPasses = passes.filter(p => {
    const isDue = (parseInt(p.returnable_balance_due, 10) || 0) > 0;
    if (statusFilter === "PENDING" && !isDue) return false;
    if (statusFilter === "COMPLETED" && isDue) return false;

    const term = search.toLowerCase();
    const matchesSearch = 
      (p.pass_number || "").toLowerCase().includes(term) ||
      (p.vendor_name || "").toLowerCase().includes(term) ||
      (p.purpose || "").toLowerCase().includes(term) ||
      (p.vehicle_number || "").toLowerCase().includes(term);

    return matchesSearch;
  });

  return (
    <div style={{ padding: "8px 0 32px", maxWidth: 1400, margin: "0 auto", color: COLORS.text }}>
      
      {/* ═══ HEADER ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.muted, marginBottom: 4 }}>
            <span>Security & Assets</span>
            <span>/</span>
            <span style={{ color: COLORS.brand, fontWeight: 600 }}>Returnable Gate Pass (RGP)</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldCheck color={COLORS.brand} size={28} />
            Returnable Asset Custody Tracker (RGP)
          </h1>
          <p style={{ margin: "4px 0 0", color: COLORS.muted, fontSize: 13 }}>
            Custody tracking for commercial LPG cylinders, stainless milk cans, beverage crates, and banquet vessels.
          </p>
        </div>

        <button
          onClick={loadRgpData}
          disabled={loading}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: COLORS.surface, border: `1px solid ${COLORS.border}`,
            color: COLORS.text, padding: "8px 14px", borderRadius: 8,
            cursor: "pointer", fontSize: 13
          }}
        >
          <RefreshCw size={14} className={loading ? "spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ═══ ASSET CUSTODY TILES ═══ */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16, marginBottom: 24
      }}>
        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
            <span>Commercial LPG (47.5kg)</span>
            <Flame size={18} color="#f97316" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: totalLpgOut > 0 ? "#f97316" : COLORS.text }}>
            {totalLpgOut} <span style={{ fontSize: 14, fontWeight: 400, color: COLORS.muted }}>due back</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
            Active cylinders with Bharat Gas / HP Gas
          </div>
        </div>

        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
            <span>Stainless Milk Cans (40L)</span>
            <Droplets size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: totalMilkCansOut > 0 ? "#38bdf8" : COLORS.text }}>
            {totalMilkCansOut} <span style={{ fontSize: 14, fontWeight: 400, color: COLORS.muted }}>due back</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
            Dairy containers with morning vendors
          </div>
        </div>

        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
            <span>Vegetable / Egg Crates</span>
            <Package size={18} color="#a855f7" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: totalCratesOut > 0 ? "#a855f7" : COLORS.text }}>
            {totalCratesOut} <span style={{ fontSize: 14, fontWeight: 400, color: COLORS.muted }}>due back</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
            Heavy plastic trays & farm crates
          </div>
        </div>

        <div style={{
          background: COLORS.surface, border: `1px solid ${COLORS.border}`,
          borderRadius: 12, padding: "16px 20px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: COLORS.muted, fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>
            <span>Banquet & Equipment</span>
            <ShieldCheck size={18} color={COLORS.brand} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6, color: totalBanquetOut > 0 ? COLORS.brand : COLORS.text }}>
            {totalBanquetOut} <span style={{ fontSize: 14, fontWeight: 400, color: COLORS.muted }}>due back</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>
            Chafing dishes, urns, event assets
          </div>
        </div>
      </div>

      {msg && (
        <div style={{
          background: "#064e3b40", border: "1px solid #059669",
          color: "#a7f3d0", padding: "12px 16px", borderRadius: 8,
          marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>{msg}</span>
          </div>
          <button onClick={() => setMsg(null)} style={{ background: "none", border: "none", color: "#a7f3d0", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═══ CONTROLS ═══ */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.muted }} />
          <input
            type="text"
            placeholder="Search RGP pass #, vendor/party name, vehicle #, or item description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px 9px 36px",
              background: COLORS.surface, border: `1px solid ${COLORS.border}`,
              borderRadius: 8, color: COLORS.text, fontSize: 13
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "9px 16px", background: COLORS.surface,
            border: `1px solid ${COLORS.border}`, borderRadius: 8,
            color: COLORS.text, fontSize: 13, cursor: "pointer"
          }}
        >
          <option value="PENDING">Pending Return Only</option>
          <option value="ALL">All Returnable Passes</option>
          <option value="COMPLETED">Fully Returned</option>
        </select>
      </div>

      {/* ═══ TABLE ═══ */}
      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 12, overflow: "hidden"
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
          <thead>
            <tr style={{ background: COLORS.bg, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ padding: "12px 16px" }}>Pass # / Date</th>
              <th style={{ padding: "12px 16px" }}>Vendor / Custodian</th>
              <th style={{ padding: "12px 16px" }}>Asset Items</th>
              <th style={{ padding: "12px 16px" }}>Qty Out</th>
              <th style={{ padding: "12px 16px" }}>Qty Returned</th>
              <th style={{ padding: "12px 16px" }}>Balance Due</th>
              <th style={{ padding: "12px 16px" }}>Status</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPasses.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "40px 16px", textAlign: "center", color: COLORS.muted }}>
                  <ShieldCheck size={32} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
                  <div>No returnable gate passes found matching your filter.</div>
                </td>
              </tr>
            ) : (
              filteredPasses.map(p => {
                const due = parseInt(p.returnable_balance_due, 10) || 0;
                const out = parseInt(p.returnable_qty_out, 10) || 0;
                const ret = parseInt(p.returnable_qty_in, 10) || 0;
                const isOverdue = due > 0 && p.return_due_date && new Date(p.return_due_date) < new Date();

                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: COLORS.brand }}>{p.pass_number}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>{p.issue_date || p.created_at?.slice(0, 10)}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 500 }}>{p.vendor_name}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>{p.vehicle_number || "No vehicle listed"}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 500 }}>{p.purpose || "Returnable Assets"}</div>
                      <div style={{ fontSize: 11, color: COLORS.muted }}>
                        {p.return_due_date ? `Expected by: ${p.return_due_date}` : "Open return date"}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                      {out}
                    </td>
                    <td style={{ padding: "12px 16px", color: COLORS.success, fontWeight: 600 }}>
                      {ret}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        fontSize: 14, fontWeight: 700,
                        color: due > 0 ? (isOverdue ? COLORS.danger : COLORS.warning) : COLORS.success
                      }}>
                        {due}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {due === 0 ? (
                        <span style={{
                          background: "#064e3b40", color: "#a7f3d0",
                          border: "1px solid #059669", padding: "2px 8px",
                          borderRadius: 6, fontSize: 11, fontWeight: 600
                        }}>
                          Completed
                        </span>
                      ) : isOverdue ? (
                        <span style={{
                          background: "#7f1d1d40", color: "#fecaca",
                          border: "1px solid #dc2626", padding: "2px 8px",
                          borderRadius: 6, fontSize: 11, fontWeight: 600
                        }}>
                          Overdue
                        </span>
                      ) : (
                        <span style={{
                          background: "#78350f40", color: "#fde68a",
                          border: "1px solid #d97706", padding: "2px 8px",
                          borderRadius: 6, fontSize: 11, fontWeight: 600
                        }}>
                          Pending Return
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      {due > 0 && (
                        <button
                          onClick={() => setSelectedPassForRgp(p)}
                          style={{
                            background: COLORS.brand, border: "none",
                            color: "#000", padding: "6px 14px", borderRadius: 6,
                            cursor: "pointer", fontSize: 12, fontWeight: 600,
                            display: "inline-flex", alignItems: "center", gap: 4
                          }}
                        >
                          <ArrowDownLeft size={14} />
                          Check-In Return
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ RECONCILE MODAL ═══ */}
      {selectedPassForRgp && (
        <ReconcileRgpModal
          isOpen={true}
          pass={selectedPassForRgp}
          onClose={() => setSelectedPassForRgp(null)}
          onSuccess={() => {
            setMsg(`Assets successfully checked in for Pass #${selectedPassForRgp.pass_number}`);
            setSelectedPassForRgp(null);
            loadRgpData();
          }}
        />
      )}

    </div>
  );
}
