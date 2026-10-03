import { useState } from "react";
import ModalShell from "../../components/ui/ModalShell";
import { COLORS } from "../../styles/colors";
import { waste } from "../../api";
import { Droplet, AlertTriangle, Check, Truck, ShieldAlert } from "lucide-react";

const DEPARTMENTS = [
  "TIFFINS",
  "STAFF",
  "SI-MEALS",
  "NORTH INDIAN",
  "CHAT & SOFTY",
  "CHINESE & DOSA",
  "MOCKTAILS & CONTINENTAL",
  "RESTAURANT",
  "ROOM SERVICE",
  "CENTRAL_STORE"
];

export default function LogRucoReadingModal({ isOpen, onClose, onSuccess, currentDrumStock = 0 }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [activeMode, setActiveMode] = useState("TEST_READING"); // TEST_READING | VENDOR_HANDOVER

  // Test Reading fields
  const [logDate, setLogDate] = useState(todayStr);
  const [department, setDepartment] = useState("CHINESE & DOSA");
  const [fryerName, setFryerName] = useState("");
  const [oilType, setOilType] = useState("Sunflower Oil");
  const [tpcPercentage, setTpcPercentage] = useState("");
  const [discardedLitres, setDiscardedLitres] = useState("");
  const [readingNotes, setReadingNotes] = useState("");

  // Vendor Handover fields
  const [collectedLitres, setCollectedLitres] = useState("");
  const [collectionVendor, setCollectionVendor] = useState("");
  const [certificateNo, setCertificateNo] = useState("");
  const [revenueRecovered, setRevenueRecovered] = useState("");
  const [disposalNotes, setDisposalNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const tpcVal = parseFloat(tpcPercentage) || 0;
  const isTpcCritical = tpcVal >= 25.0;
  const isTpcWarning = tpcVal >= 21.0 && tpcVal < 25.0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (activeMode === "TEST_READING") {
        if (!fryerName.trim()) {
          setError("Fryer / Station name is required (e.g. Master Dosa Fryer #1)");
          setLoading(false);
          return;
        }
        if (isNaN(parseFloat(tpcPercentage)) || parseFloat(tpcPercentage) < 0) {
          setError("Please enter a valid Total Polar Compounds (TPC) %");
          setLoading(false);
          return;
        }

        let status = "SAFE_FOR_FRYING";
        if (tpcVal >= 25.0) {
          status = "DISCARDED_TO_RUCO_DRUM";
        } else if (tpcVal >= 21.0) {
          status = "TOP_UP_REQUIRED";
        }

        await waste.logRuco({
          log_date: logDate,
          department,
          fryer_name: fryerName.trim(),
          oil_type: oilType,
          tpc_percentage: tpcVal,
          status,
          discarded_litres: parseFloat(discardedLitres) || (isTpcCritical ? 20.0 : 0),
          notes: readingNotes.trim() || undefined
        });
      } else {
        // VENDOR_HANDOVER
        const litres = parseFloat(collectedLitres);
        if (isNaN(litres) || litres <= 0) {
          setError("Please enter valid collected litres (> 0)");
          setLoading(false);
          return;
        }
        if (litres > currentDrumStock) {
          setError(`Cannot hand over ${litres} L: current RUCO drum stock is only ${currentDrumStock} L.`);
          setLoading(false);
          return;
        }
        if (!collectionVendor.trim()) {
          setError("Authorized Biodiesel Vendor name is required (FSSAI registered)");
          setLoading(false);
          return;
        }
        if (!certificateNo.trim()) {
          setError("FSSAI RUCO Collection Certificate # is required");
          setLoading(false);
          return;
        }

        await waste.recordRucoDisposal({
          log_date: logDate,
          department: "CENTRAL_STORE",
          collected_litres: litres,
          collection_vendor: collectionVendor.trim(),
          collection_certificate_no: certificateNo.trim(),
          revenue_recovered: parseFloat(revenueRecovered) || 0,
          notes: disposalNotes.trim() || "Handed over to authorized FSSAI RUCO aggregator for biodiesel conversion."
        });
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to record RUCO oil entry");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      size="default"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Droplet size={22} color={COLORS.gold} />
          <div>
            <div style={{ fontSize: "1.05rem", fontWeight: 600, color: COLORS.text }}>
              FSSAI RUCO — Used Cooking Oil Management
            </div>
            <span style={{ fontSize: "0.78rem", color: COLORS.textMuted }}>
              Repurpose Used Cooking Oil compliance (Statutory Limit: TPC &le; 25.0%)
            </span>
          </div>
        </div>
      }
    >
      {/* Mode Selector Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${COLORS.border}`, marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => { setActiveMode("TEST_READING"); setError(""); }}
            style={{
              padding: "12px 18px",
              background: "none",
              border: "none",
              borderBottom: activeMode === "TEST_READING" ? `2px solid ${COLORS.gold}` : "2px solid transparent",
              color: activeMode === "TEST_READING" ? COLORS.gold : COLORS.textMuted,
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Droplet size={15} />
            Fryer TPC% Test Reading
          </button>
          <button
            type="button"
            onClick={() => { setActiveMode("VENDOR_HANDOVER"); setError(""); }}
            style={{
              padding: "12px 18px",
              background: "none",
              border: "none",
              borderBottom: activeMode === "VENDOR_HANDOVER" ? `2px solid ${COLORS.gold}` : "2px solid transparent",
              color: activeMode === "VENDOR_HANDOVER" ? COLORS.gold : COLORS.textMuted,
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Truck size={15} />
            Biodiesel Collector Handover
          </button>
        </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(220, 53, 69, 0.15)",
                  border: "1px solid #dc3545",
                  color: "#ff6b6b",
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Current Drum Status Banner */}
            <div
              style={{
                backgroundColor: "var(--border-color)",
                border: `1px solid ${COLORS.border}`,
                borderRadius: "8px",
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Current Central Drum Yard Stock
                </span>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: COLORS.gold, marginTop: "2px" }}>
                  {currentDrumStock.toFixed(2)} Litres
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.75rem", color: COLORS.textMuted }}>Standard Drum Capacity</span>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: COLORS.text, marginTop: "2px" }}>
                  200 Litres ({(Math.min(100, (currentDrumStock / 200) * 100)).toFixed(0)}% full)
                </div>
              </div>
            </div>

            {/* TEST READING MODE */}
            {activeMode === "TEST_READING" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      Log Date *
                    </label>
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "6px",
                        color: COLORS.text,
                        fontSize: "0.88rem"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      Kitchen Department *
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "6px",
                        color: COLORS.text,
                        fontSize: "0.88rem"
                      }}
                    >
                      {DEPARTMENTS.filter(d => d !== "CENTRAL_STORE").map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      Fryer / Station Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Master Dosa Station Fryer #2"
                      value={fryerName}
                      onChange={(e) => setFryerName(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "6px",
                        color: COLORS.text,
                        fontSize: "0.88rem"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      Oil Type
                    </label>
                    <select
                      value={oilType}
                      onChange={(e) => setOilType(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "6px",
                        color: COLORS.text,
                        fontSize: "0.88rem"
                      }}
                    >
                      <option value="Sunflower Oil">Sunflower Oil</option>
                      <option value="Palmolein Oil">Palmolein Oil</option>
                      <option value="Mustard Oil">Mustard Oil</option>
                      <option value="Groundnut Oil">Groundnut Oil</option>
                      <option value="Blended Vegetable Oil">Blended Vegetable Oil</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      Digital TPC Meter Reading (%) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="e.g. 18.5"
                      value={tpcPercentage}
                      onChange={(e) => setTpcPercentage(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${isTpcCritical ? "#ff4d4f" : isTpcWarning ? "#faad14" : COLORS.border}`,
                        borderRadius: "6px",
                        color: isTpcCritical ? "#ff7875" : isTpcWarning ? "#ffd666" : COLORS.text,
                        fontSize: "0.95rem",
                        fontWeight: 600
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      Discarded to RUCO Drum (L)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder={isTpcCritical ? "20.0" : "0.0"}
                      value={discardedLitres}
                      onChange={(e) => setDiscardedLitres(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "6px",
                        color: COLORS.text,
                        fontSize: "0.88rem"
                      }}
                    />
                  </div>
                </div>

                {/* Statutory TPC Guidance Alert */}
                {tpcPercentage !== "" && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: "6px",
                      backgroundColor: isTpcCritical
                        ? "rgba(220, 53, 69, 0.15)"
                        : isTpcWarning
                        ? "rgba(255, 193, 7, 0.15)"
                        : "rgba(40, 167, 69, 0.15)",
                      border: `1px solid ${isTpcCritical ? "#dc3545" : isTpcWarning ? "#ffc107" : "#28a745"}`,
                      display: "flex",
                      alignItems: "center",
                      gap: "10px"
                    }}
                  >
                    {isTpcCritical ? (
                      <ShieldAlert size={18} color="#ff4d4f" />
                    ) : (
                      <Check size={18} color={isTpcWarning ? "#ffc107" : "#28a745"} />
                    )}
                    <span style={{ fontSize: "0.82rem", color: isTpcCritical ? "#ff7875" : isTpcWarning ? "#ffe58f" : "#95de64" }}>
                      {isTpcCritical
                        ? "FSSAI STATUTORY VIOLATION WARNING: TPC is >= 25.0%! This oil is degraded and harmful. It MUST be discarded immediately into the RUCO Drum for biodiesel conversion."
                        : isTpcWarning
                        ? "CAUTION: TPC is between 21.0% and 24.9%. High degradation. Frequent top-up or impending discard recommended within 24h."
                        : "COMPLIANT: TPC is within safe limits (< 21.0%). Approved for culinary frying."}
                    </span>
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                    Observation / Action Notes
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Cleaned crumb tray and drained batch into Drum #3."
                    value={readingNotes}
                    onChange={(e) => setReadingNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: COLORS.bgDark,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: "6px",
                      color: COLORS.text,
                      fontSize: "0.85rem",
                      resize: "none"
                    }}
                  />
                </div>
              </>
            )}

            {/* BIODIESEL VENDOR HANDOVER MODE */}
            {activeMode === "VENDOR_HANDOVER" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      Handover Date *
                    </label>
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "6px",
                        color: COLORS.text,
                        fontSize: "0.88rem"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      Volume Handed Over (Litres) *
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max={currentDrumStock || 1000}
                      placeholder="e.g. 180"
                      value={collectedLitres}
                      onChange={(e) => setCollectedLitres(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "6px",
                        color: COLORS.text,
                        fontSize: "0.88rem"
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      Authorized Biodiesel Recycler *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BioFuel India Aggregators Pvt Ltd"
                      value={collectionVendor}
                      onChange={(e) => setCollectionVendor(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "6px",
                        color: COLORS.text,
                        fontSize: "0.88rem"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      FSSAI RUCO Certificate # *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. RUCO-AP-2026-883"
                      value={certificateNo}
                      onChange={(e) => setCertificateNo(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "6px",
                        color: COLORS.text,
                        fontSize: "0.88rem"
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                      Revenue / Buyback Amount Recovered (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      placeholder="e.g. 5400"
                      value={revenueRecovered}
                      onChange={(e) => setRevenueRecovered(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        backgroundColor: COLORS.bgDark,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: "6px",
                        color: COLORS.gold,
                        fontSize: "0.88rem",
                        fontWeight: 600
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.8rem", color: COLORS.textMuted, marginBottom: "6px" }}>
                    Handover Notes / Manifest details
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Dispatched in two 100L HDPE drums via vehicle AP 29 TA 4920."
                    value={disposalNotes}
                    onChange={(e) => setDisposalNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      backgroundColor: COLORS.bgDark,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: "6px",
                      color: COLORS.text,
                      fontSize: "0.85rem",
                      resize: "none"
                    }}
                  />
                </div>
              </>
            )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "20px",
            paddingTop: "16px",
            borderTop: `1px solid ${COLORS.border}`
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              backgroundColor: "transparent",
              border: `1px solid ${COLORS.border}`,
              color: COLORS.textMuted,
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "8px 20px",
              borderRadius: "6px",
              backgroundColor: COLORS.gold,
              border: "none",
              color: "#111",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: loading ? 0.7 : 1
            }}
          >
            <Check size={16} />
            {loading ? "Recording..." : activeMode === "TEST_READING" ? "Save TPC Reading" : "Record Handover"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
