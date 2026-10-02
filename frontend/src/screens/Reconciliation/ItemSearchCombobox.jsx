import { useState, useRef, useEffect } from "react";
import { COLORS } from "../../styles/colors";

const CATEGORY_ICONS = {
  Vegetables: "??", Dairy: "??", Grocery: "??", Spices: "???",
  Bakery: "??", Beverages: "??", Disposables: "???", Meat: "??",
  Fruits: "??", Dry: "??", Cleaning: "??",
};

export default function ItemSearchCombobox({ stocks, value, onChange, placeholder = "Search item�" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value?.name || "");
  const ref = useRef(null);

  useEffect(() => {
    setQuery(value?.name || "");
  }, [value]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Build unique item_code ? best batch map from stocks array
  const stockMap = {};
  stocks.forEach((s) => {
    if (!stockMap[s.item_code]) {
      stockMap[s.item_code] = { name: s.name, item_code: s.item_code, unit: s.unit, category: s.category || "Other", remaining: 0, price: parseFloat(s.price || 0) };
    }
    stockMap[s.item_code].remaining += parseFloat(s.remaining || 0);
  });
  const allItems = Object.values(stockMap).sort((a, b) => a.name.localeCompare(b.name));

  const filtered = query.trim().length === 0
    ? allItems
    : allItems.filter((it) =>
        it.name.toLowerCase().includes(query.toLowerCase()) ||
        it.item_code.toLowerCase().includes(query.toLowerCase())
      );

  const pick = (item) => {
    setQuery(item.name);
    setOpen(false);
    onChange(item);
  };

  const stockColor = (rem) => rem > 10 ? COLORS.success : rem > 0 ? "#e8a838" : COLORS.coral;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(null); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={{
          width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
          color: COLORS.text, borderRadius: 6, padding: "7px 10px", fontSize: 13,
          outline: "none", boxSizing: "border-box",
        }}
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 999,
          background: "#1a1f2e", border: `1px solid ${COLORS.border}`, borderRadius: 8,
          maxHeight: 260, overflowY: "auto", boxShadow: "0 8px 32px #0007",
        }}>
          {filtered.slice(0, 60).map((it) => (
            <div
              key={it.item_code}
              onMouseDown={() => pick(it)}
              style={{
                padding: "9px 14px", cursor: "pointer", display: "flex",
                justifyContent: "space-between", alignItems: "center",
                borderBottom: `1px solid ${COLORS.border}22`,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#ffffff0d"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div>
                <span style={{ fontSize: 13, color: COLORS.text, fontWeight: 500 }}>
                  {CATEGORY_ICONS[it.category] || "??"} {it.name}
                </span>
                <span style={{ fontSize: 11, color: COLORS.muted, marginLeft: 8, fontFamily: "monospace" }}>
                  {it.item_code}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: stockColor(it.remaining), fontWeight: 600 }}>
                  {it.remaining.toFixed(1)} {it.unit}
                </span>
                <span style={{ fontSize: 10, color: COLORS.muted }}>
                  ?{it.price.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
