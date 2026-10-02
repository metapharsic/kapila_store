import React, { useState } from "react";
import { X, Plus, Trash2, Check, AlertTriangle, Save } from "lucide-react";
import { COLORS } from "../../../styles/colors";
import * as api from "../../../api";

export default function CreateDishModal({ onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [basePlates, setBasePlates] = useState(100);
  const [items, setItems] = useState([{ id: Date.now(), item_name: "", base_qty: "", unit: "kg" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAddItem = () => {
    setItems((prev) => [...prev, { id: Date.now(), item_name: "", base_qty: "", unit: "kg" }]);
  };

  const handleRemoveItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleItemChange = (id, field, value) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Dish name is required.");
      return;
    }

    const validItems = items.filter((it) => it.item_name.trim() && parseFloat(it.base_qty) > 0);
    if (validItems.length === 0) {
      setError("Please add at least one valid ingredient with a quantity > 0.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim() || "GENERAL",
        base_plates: parseInt(basePlates) || 100,
        items: validItems.map((it) => ({
          item_name: it.item_name.trim(),
          base_qty: parseFloat(it.base_qty),
          unit: it.unit || "kg",
        })),
      };

      const res = await api.recipes.create(payload);
      if (res.success) {
        onSuccess(res.data);
      } else {
        setError(res.error || "Failed to create dish.");
      }
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background: "white", borderRadius: "16px",
        width: "100%", maxWidth: "600px",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #E5E7EB",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          background: "#1E293B",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "white" }}>
              🍳 Create Custom Dish
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#94A3B8" }}>
              Define a new dish and its base ingredients to save it for future indents.
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#94A3B8", cursor: "pointer",
            padding: "4px", borderRadius: "6px", transition: "all 0.2s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#334155"; e.currentTarget.style.color = "white"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#94A3B8"; }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "#F8FAFC" }}>
          {error && (
            <div style={{ padding: "12px", background: "#FEF2F2", color: "#991B1B", borderRadius: "8px", fontSize: "13px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Dish Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tiffins Poori"
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. TIFFINS"
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none", boxSizing: "border-box", textTransform: "uppercase" }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>Base Plates</label>
            <input
              type="number"
              min="1"
              value={basePlates}
              onChange={(e) => setBasePlates(e.target.value)}
              style={{ width: "100%", maxWidth: "150px", padding: "10px", borderRadius: "8px", border: "1px solid #CBD5E1", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
            />
            <p style={{ fontSize: "11px", color: "#64748B", marginTop: "4px", margin: 0 }}>Ingredients below will be scaled based on this number.</p>
          </div>

          <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", background: "#F1F5F9", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#1E293B" }}>Base Ingredients</span>
              <button onClick={handleAddItem} style={{
                background: "white", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "4px 10px",
                fontSize: "12px", fontWeight: 600, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px"
              }}>
                <Plus size={14} /> Add Row
              </button>
            </div>
            <div style={{ padding: "8px" }}>
              {items.map((it, idx) => (
                <div key={it.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <input
                      placeholder="Ingredient Name (e.g. Wheat Flour)"
                      value={it.item_name}
                      onChange={(e) => handleItemChange(it.id, "item_name", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ width: "90px" }}>
                    <input
                      type="number"
                      placeholder="Qty"
                      min="0"
                      step="0.01"
                      value={it.base_qty}
                      onChange={(e) => handleItemChange(it.id, "base_qty", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                  <div style={{ width: "80px" }}>
                    <select
                      value={it.unit}
                      onChange={(e) => handleItemChange(it.id, "unit", e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #CBD5E1", fontSize: "13px", outline: "none", boxSizing: "border-box", background: "white" }}
                    >
                      <option value="kg">kg</option>
                      <option value="ltr">ltr</option>
                      <option value="pcs">pcs</option>
                      <option value="pkt">pkt</option>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                    </select>
                  </div>
                  <button onClick={() => handleRemoveItem(it.id)} disabled={items.length === 1} style={{
                    background: "none", border: "none", padding: "8px", color: items.length === 1 ? "#CBD5E1" : "#EF4444", cursor: items.length === 1 ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div style={{
          padding: "16px 24px", background: "white", borderTop: "1px solid #E5E7EB",
          display: "flex", justifyContent: "flex-end", gap: "12px"
        }}>
          <button onClick={onClose} disabled={loading} style={{
            background: "white", border: "1px solid #CBD5E1", color: "#475569",
            padding: "8px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer"
          }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{
            background: COLORS.primary, border: "none", color: "white",
            padding: "8px 20px", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px", opacity: loading ? 0.7 : 1
          }}>
            {loading ? "Saving..." : <><Save size={16} /> Save Dish</>}
          </button>
        </div>
      </div>
    </div>
  );
}
