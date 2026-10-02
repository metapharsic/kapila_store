import React, { useState } from "react";
import { COLORS } from "../../styles/colors";
import { utility } from "../../api";
import { Gauge, AlertCircle, X, Check, Clock, Flame, Zap, Droplets } from "lucide-react";

export default function RecordUtilityReadingModal({ isOpen, onClose, onSuccess }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [readingDate, setReadingDate] = useState(todayStr);
  const [shift, setShift] = useState("MORNING");

  // LPG
  const [lpgStartKg, setLpgStartKg] = useState("");
  const [lpgEndKg, setLpgEndKg] = useState("");
  const [lpgActiveCylinders, setLpgActiveCylinders] = useState("8");
  const [lpgEmptyCylinders, setLpgEmptyCylinders] = useState("4");
  const [lpgFullCylinders, setLpgFullCylinders] = useState("10");
  const [lpgPressureBar, setLpgPressureBar] = useState("1.50");

  // EB & DG
  const [ebMeterStart, setEbMeterStart] = useState("");
  const [ebMeterEnd, setEbMeterEnd] = useState("");
  const [dgRunHours, setDgRunHours] = useState("0");
  const [dgDieselConsumed, setDgDieselConsumed] = useState("0");
  const [dgDieselStock, setDgDieselStock] = useState("450");

  // Water
  const [waterTankerCount, setWaterTankerCount] = useState("0");
  const [waterTankerLitres, setWaterTankerLitres] = useState("0");
  const [roPlantOutput, setRoPlantOutput] = useState("4000");

  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const lpgDelta = Math.max(0, (parseFloat(lpgStartKg) || 0) - (parseFloat(lpgEndKg) || 0));
  const ebDelta = Math.max(0, (parseFloat(ebMeterEnd) || 0) - (parseFloat(ebMeterStart) || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!readingDate) {
      setError("Reading date is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await utility.createReading({
        reading_date: readingDate,
        shift,
        lpg_start_kg: parseFloat(lpgStartKg) || 0,
        lpg_end_kg: parseFloat(lpgEndKg) || 0,
        lpg_consumed_kg: lpgDelta,
        lpg_active_cylinders: parseInt(lpgActiveCylinders, 10) || 8,
        lpg_empty_cylinders: parseInt(lpgEmptyCylinders, 10) || 0,
        lpg_full_cylinders: parseInt(lpgFullCylinders, 10) || 0,
        lpg_pressure_bar: parseFloat(lpgPressureBar) || 1.50,
        eb_meter_start: parseFloat(ebMeterStart) || 0,
        eb_meter_end: parseFloat(ebMeterEnd) || 0,
        eb_units_consumed: ebDelta,
        dg_run_hours: parseFloat(dgRunHours) || 0,
        dg_diesel_consumed_litres: parseFloat(dgDieselConsumed) || 0,
        dg_diesel_stock_litres: parseFloat(dgDieselStock) || 0,
        water_tanker_count: parseInt(waterTankerCount, 10) || 0,
        water_tanker_litres: parseFloat(waterTankerLitres) || 0,
        ro_plant_output_litres: parseFloat(roPlantOutput) || 0,
        notes: notes.trim()
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to record shift utility reading");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0, 0, 0, 0.8)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "20px"
    }}>
      <div style={{
        background: "var(--bg-modal)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: "14px",
        width: "100%",
        maxWidth: "720px",
        maxHeight: "92vh",
        overflowY: "auto",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        color: "var(--text-main)"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 22px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.6) 100%)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "var(--color-gold-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-gold)"
            }}>
              <Gauge size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "700", margin: 0 }}>
                Log Shift Utility & Energy Reading
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                Commercial LPG manifold, electricity EB meter, DG fuel, and water balance
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{
            margin: "14px 22px 0",
            padding: "10px 14px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#FCA5A5",
            fontSize: "12px"
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: "20px 22px" }}>
          {/* Shift and Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "18px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Reading Date *
              </label>
              <input
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "4px" }}>
                Shift *
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  color: "var(--text-main)",
                  fontSize: "13px"
                }}
              >
                <option value="MORNING">Morning Shift (Breakfast & Lunch)</option>
                <option value="EVENING">Evening Shift (Dinner & Night prep)</option>
                <option value="NIGHT">Night Shift (Bakery & Deep prep)</option>
                <option value="FULL_DAY">Full Day 24h Aggregated</option>
              </select>
            </div>
          </div>

          {/* Section 1: Commercial LPG Manifold */}
          <div style={{
            padding: "14px",
            background: "rgba(245, 158, 11, 0.05)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "10px",
            marginBottom: "16px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Flame size={16} color="#F59E0B" />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#F59E0B" }}>
                Commercial LPG Cylinder Bank (Manifold)
              </span>
              {lpgDelta > 0 && (
                <span style={{ marginLeft: "auto", fontSize: "12px", color: "#FBBF24", fontWeight: "700" }}>
                  Burned: {lpgDelta.toFixed(2)} Kg
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Start Weight (Kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 380.0"
                  value={lpgStartKg}
                  onChange={(e) => setLpgStartKg(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  End Weight (Kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 335.5"
                  value={lpgEndKg}
                  onChange={(e) => setLpgEndKg(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Manifold Pressure (Bar)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={lpgPressureBar}
                  onChange={(e) => setLpgPressureBar(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Active on Manifold
                </label>
                <input
                  type="number"
                  value={lpgActiveCylinders}
                  onChange={(e) => setLpgActiveCylinders(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Empty in Yard
                </label>
                <input
                  type="number"
                  value={lpgEmptyCylinders}
                  onChange={(e) => setLpgEmptyCylinders(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Full in Stock
                </label>
                <input
                  type="number"
                  value={lpgFullCylinders}
                  onChange={(e) => setLpgFullCylinders(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Power & DG Set */}
          <div style={{
            padding: "14px",
            background: "rgba(59, 130, 246, 0.05)",
            border: "1px solid rgba(59, 130, 246, 0.2)",
            borderRadius: "10px",
            marginBottom: "16px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Zap size={16} color="#60A5FA" />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#60A5FA" }}>
                Electricity (EB) & DG Generator
              </span>
              {ebDelta > 0 && (
                <span style={{ marginLeft: "auto", fontSize: "12px", color: "#93C5FD", fontWeight: "700" }}>
                  EB Consumed: {ebDelta.toFixed(1)} kWh
                </span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  EB Meter Start (kWh)
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 142000.0"
                  value={ebMeterStart}
                  onChange={(e) => setEbMeterStart(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  EB Meter End (kWh)
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 142450.0"
                  value={ebMeterEnd}
                  onChange={(e) => setEbMeterEnd(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  DG Run Hours
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={dgRunHours}
                  onChange={(e) => setDgRunHours(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  DG Diesel Consumed (L)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={dgDieselConsumed}
                  onChange={(e) => setDgDieselConsumed(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Diesel Day Tank Stock (L)
                </label>
                <input
                  type="number"
                  step="1"
                  value={dgDieselStock}
                  onChange={(e) => setDgDieselStock(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Water Tanker & RO */}
          <div style={{
            padding: "14px",
            background: "rgba(16, 185, 129, 0.05)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            borderRadius: "10px",
            marginBottom: "16px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Droplets size={16} color="#34D399" />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#34D399" }}>
                Water Supply & RO Output
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Water Tanker Count
                </label>
                <input
                  type="number"
                  value={waterTankerCount}
                  onChange={(e) => {
                    const c = parseInt(e.target.value, 10) || 0;
                    setWaterTankerCount(e.target.value);
                    setWaterTankerLitres(String(c * 12000));
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Tanker Litres
                </label>
                <input
                  type="number"
                  value={waterTankerLitres}
                  onChange={(e) => setWaterTankerLitres(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  RO Plant Yield (L)
                </label>
                <input
                  type="number"
                  value={roPlantOutput}
                  onChange={(e) => setRoPlantOutput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "6px",
                    color: "var(--text-main)",
                    fontSize: "12px"
                  }}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "6px" }}>
              Shift Observation / Maintenance Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Manifold pressure steady at 1.5 bar; RO filter backwashed during morning shift."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-main)",
                fontSize: "13px"
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                fontSize: "12px",
                fontWeight: "600",
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
                background: "linear-gradient(135deg, var(--color-gold) 0%, #ca8a04 100%)",
                border: "none",
                borderRadius: "8px",
                color: "var(--bg-modal)",
                fontSize: "12px",
                fontWeight: "700",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {loading ? <Clock size={15} /> : <Check size={15} />}
              {loading ? "Recording..." : "Save Shift Reading"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
