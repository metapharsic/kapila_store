import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Plus, Minus, Search, X, Sparkles, Check, AlertTriangle, 
  Package, TrendingUp, Tag, ShieldCheck, Zap, Info, Clock, DollarSign,
  ChevronRight, Layers, FilePlus, RefreshCw
} from "lucide-react";
import { COLORS, UNITS } from "../../styles/colors";
import { getCompatibleUnits, areUnitsCompatible, CANONICAL_UNITS } from "../../utils/units";
import * as api from "../../api";

const CATEGORIES = [
  { id: "all", label: "All Items", icon: "📦" },
  { id: "vegetables", label: "Vegetables & Produce", icon: "🥬" },
  { id: "dairy", label: "Dairy & Chilled", icon: "🥛" },
  { id: "grocery", label: "Grocery & Staples", icon: "🍚" },
  { id: "spices", label: "Spices & Seasoning", icon: "🌶️" },
  { id: "bakery", label: "Bakery & Flour", icon: "🍞" },
  { id: "beverages", label: "Beverages & Syrups", icon: "🥤" },
  { id: "disposables", label: "Disposables & Non-Food", icon: "🍽️" }
];

export default function EnhancedItemAdditionModal({
  open,
  onClose,
  dept,
  existingItems = [],
  stocks = [],
  deptItemsMap = {},
  availableStock = {},
  onAddItems,
  onAddTemplateItem
}) {
  const [activeTab, setActiveTab] = useState("catalog"); // "catalog" | "recommendations" | "custom"
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [deptOnly, setDeptOnly] = useState(true);
  const [inStockOnly, setInStockOnly] = useState(false);
  
  // Pending quantities map: { [itemName]: { qty: number, unit: string, item_code: string, price: number, notes: string } }
  const [selectedQuantities, setSelectedQuantities] = useState({});
  
  // Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  
  // Custom item state
  const [customForm, setCustomForm] = useState({
    name: "",
    category: "vegetables",
    unit: "kg",
    qty: "1",
    price: "",
    urgency: "routine", // "routine" | "urgent" | "emergency"
    notes: "",
    saveToTemplate: false
  });
  const [customError, setCustomError] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);
  
  const searchInputRef = useRef(null);

  // Auto-detect if custom item matches existing stock item
  const matchedStock = useMemo(() => {
    if (!customForm.name.trim()) return null;
    const n = customForm.name.trim().toLowerCase();
    return stocks.find(s => s && s.name && s.name.trim().toLowerCase() === n) || null;
  }, [customForm.name, stocks]);

  const customAllowedUnits = useMemo(() => {
    if (matchedStock?.unit) {
      return getCompatibleUnits(matchedStock.unit);
    }
    return CANONICAL_UNITS;
  }, [matchedStock]);

  useEffect(() => {
    if (matchedStock?.unit && !areUnitsCompatible(customForm.unit, matchedStock.unit, customForm.name)) {
      setCustomForm(prev => ({ ...prev, unit: matchedStock.unit }));
    }
  }, [matchedStock]);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setSelectedQuantities({});
      setSearchQuery("");
      setActiveTab("catalog");
      setCustomError("");
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 150);
    }
  }, [open]);

  // Load recommendations when tab is clicked
  useEffect(() => {
    if (open && activeTab === "recommendations" && dept) {
      setLoadingRecs(true);
      api.indents.recommendations({ dept })
        .then((res) => {
          if (res.success) {
            setRecommendations(res.data || []);
          }
        })
        .catch((err) => console.error("Failed to load recommendations:", err))
        .finally(() => setLoadingRecs(false));
    }
  }, [open, activeTab, dept]);

  // Category classification helper
  const classifyItem = (name = "", category = "") => {
    const n = name.toLowerCase();
    const c = (category || "").toLowerCase();
    if (c.includes("veg") || n.includes("onion") || n.includes("potato") || n.includes("tomato") || n.includes("chilli") || n.includes("ginger") || n.includes("garlic") || n.includes("lemon") || n.includes("coriander") || n.includes("mint") || n.includes("carrot") || n.includes("beans") || n.includes("cabbage")) return "vegetables";
    if (c.includes("dairy") || n.includes("milk") || n.includes("curd") || n.includes("paneer") || n.includes("butter") || n.includes("cheese") || n.includes("cream") || n.includes("ghee")) return "dairy";
    if (c.includes("flour") || c.includes("bakery") || n.includes("bread") || n.includes("atta") || n.includes("maida") || n.includes("rava") || n.includes("baking") || n.includes("bun") || n.includes("yeast")) return "bakery";
    if (c.includes("spice") || n.includes("masala") || n.includes("turmeric") || n.includes("cardamom") || n.includes("clove") || n.includes("cinnamon") || n.includes("jeera") || n.includes("mustard") || n.includes("pepper")) return "spices";
    if (c.includes("bev") || n.includes("tea") || n.includes("coffee") || n.includes("juice") || n.includes("syrup") || n.includes("crush") || n.includes("soda") || n.includes("drink")) return "beverages";
    if (c.includes("disp") || n.includes("paper") || n.includes("foil") || n.includes("container") || n.includes("cover") || n.includes("box") || n.includes("cup") || n.includes("napkin") || n.includes("spoon")) return "disposables";
    if (c.includes("groc") || n.includes("rice") || n.includes("dal") || n.includes("oil") || n.includes("sugar") || n.includes("salt") || n.includes("besan")) return "grocery";
    return "grocery";
  };

  // Build department items map & canonical stocks list
  const canonicalDeptItems = useMemo(() => {
    if (!dept) return new Set();
    const items = deptItemsMap[dept] || deptItemsMap[dept.toUpperCase()] || [];
    return new Set(items.map(it => (typeof it === "string" ? it : it.name).toLowerCase().trim()));
  }, [dept, deptItemsMap]);

  // Existing items lookup for duplicate & current quantity display
  const existingItemsMap = useMemo(() => {
    const map = {};
    existingItems.forEach(it => {
      if (it.name) {
        const key = it.name.toLowerCase().trim();
        const currentQty = parseFloat(it.qty) || 0;
        map[key] = (map[key] || 0) + currentQty;
      }
    });
    return map;
  }, [existingItems]);

  // Unique catalog items with enriched metadata
  const enrichedCatalog = useMemo(() => {
    const seen = new Set();
    const list = [];

    stocks.forEach(s => {
      if (!s || !s.name) return;
      const cleanName = s.name.trim();
      const lower = cleanName.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);

      const isDeptItem = canonicalDeptItems.has(lower);
      const cat = classifyItem(cleanName, s.category);
      
      // Stock balance
      const availObj = availableStock[lower];
      const stockRemaining = availObj !== undefined && availObj.remaining !== undefined 
        ? parseFloat(availObj.remaining) 
        : (parseFloat(s.remaining) || parseFloat(s.qty) || 0);
      
      // Catalog price
      const rate = availObj?.price ? parseFloat(availObj.price) : (parseFloat(s.price) || 0);

      list.push({
        name: cleanName,
        item_code: s.item_code || "KPL-GEN",
        unit: s.unit || "kg",
        category: cat,
        isDeptItem,
        remaining: stockRemaining,
        rate: rate > 0 ? rate : 0,
        min_alert_qty: parseFloat(s.min_alert_qty) || 5
      });
    });

    return list;
  }, [stocks, canonicalDeptItems, availableStock]);

  // Filtered items based on search, category, deptOnly, and inStockOnly
  const filteredCatalog = useMemo(() => {
    let result = enrichedCatalog;

    if (deptOnly && canonicalDeptItems.size > 0) {
      result = result.filter(item => item.isDeptItem);
    }

    if (activeCategory !== "all") {
      result = result.filter(item => item.category === activeCategory);
    }

    if (inStockOnly) {
      result = result.filter(item => item.remaining > 0);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) ||
        item.item_code.toLowerCase().includes(q)
      );
    }

    // Sort: Dept items first, then alphabetically
    return result.sort((a, b) => {
      if (a.isDeptItem && !b.isDeptItem) return -1;
      if (!a.isDeptItem && b.isDeptItem) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [enrichedCatalog, deptOnly, canonicalDeptItems, activeCategory, inStockOnly, searchQuery]);

  // Quantity Stepper Handlers
  const handleQuantityChange = (item, delta) => {
    const key = item.name.toLowerCase().trim();
    const current = selectedQuantities[key]?.qty || 0;
    const next = Math.max(0, parseFloat((current + delta).toFixed(2)));

    if (next === 0) {
      setSelectedQuantities(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    } else {
      setSelectedQuantities(prev => ({
        ...prev,
        [key]: {
          name: item.name,
          qty: next,
          unit: item.unit,
          item_code: item.item_code,
          price: item.rate,
          isDeptItem: item.isDeptItem
        }
      }));
    }
  };

  const handleManualQuantityInput = (item, val) => {
    const key = item.name.toLowerCase().trim();
    if (val === "" || isNaN(parseFloat(val))) {
      setSelectedQuantities(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      return;
    }

    const next = Math.max(0, parseFloat(parseFloat(val).toFixed(2)));
    if (next === 0) {
      setSelectedQuantities(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    } else {
      setSelectedQuantities(prev => ({
        ...prev,
        [key]: {
          name: item.name,
          qty: next,
          unit: item.unit,
          item_code: item.item_code,
          price: item.rate,
          isDeptItem: item.isDeptItem
        }
      }));
    }
  };

  const handlePresetAdd = (item, presetVal) => {
    const key = item.name.toLowerCase().trim();
    const current = selectedQuantities[key]?.qty || 0;
    const next = current + presetVal;
    setSelectedQuantities(prev => ({
      ...prev,
      [key]: {
        name: item.name,
        qty: next,
        unit: item.unit,
        item_code: item.item_code,
        price: item.rate,
        isDeptItem: item.isDeptItem
      }
    }));
  };

  // Submit Selected Items to Indent
  const handleConfirmAdd = () => {
    const itemsToAdd = Object.values(selectedQuantities).filter(i => i.qty > 0);
    if (itemsToAdd.length === 0) return;

    if (onAddItems) {
      onAddItems(itemsToAdd);
    }
    onClose();
  };

  // Custom Item Form Submit
  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    setCustomError("");

    if (!customForm.name.trim()) {
      setCustomError("Please enter an item name.");
      return;
    }
    if (matchedStock && !areUnitsCompatible(customForm.unit, matchedStock.unit, customForm.name)) {
      setCustomError(`Unit "${customForm.unit}" is dimensionally incompatible with inventory stock unit "${matchedStock.unit}" for ${matchedStock.name}.`);
      return;
    }
    const qtyNum = parseFloat(customForm.qty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setCustomError("Please enter a valid quantity greater than 0.");
      return;
    }

    setSavingCustom(true);
    try {
      const generatedCode = `KPL-SPL-${Math.floor(1000 + Math.random() * 9000)}`;
      const priceNum = parseFloat(customForm.price) || 0;

      // Optionally save to department template permanently
      if (customForm.saveToTemplate && onAddTemplateItem && dept) {
        await onAddTemplateItem({
          department: dept,
          item_name: customForm.name.trim(),
          item_code: generatedCode,
          default_unit: customForm.unit
        });
      }

      const customItem = {
        name: customForm.name.trim(),
        qty: qtyNum,
        unit: customForm.unit,
        item_code: generatedCode,
        price: priceNum,
        is_custom: true,
        urgency: customForm.urgency,
        notes: customForm.notes ? customForm.notes.trim() : `Special requisition (${customForm.urgency})`
      };

      if (onAddItems) {
        onAddItems([customItem]);
      }
      onClose();
    } catch (err) {
      console.error("Failed to add custom item:", err);
      setCustomError(err.message || "Failed to process custom item.");
    } finally {
      setSavingCustom(false);
    }
  };

  // Selected Count & Estimated Value
  const selectedList = Object.values(selectedQuantities);
  const selectedCount = selectedList.length;
  const totalEstimatedCost = selectedList.reduce((acc, curr) => {
    return acc + (curr.qty * (curr.price || 0));
  }, 0);

  if (!open) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(15, 23, 42, 0.82)",
      backdropFilter: "blur(6px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2000,
      padding: "16px",
      animation: "fadeIn 0.18s ease-out"
    }}>
      <div style={{
        background: "#0F172A",
        border: "1px solid #334155",
        borderRadius: "16px",
        width: "920px",
        maxWidth: "96vw",
        height: "88vh",
        maxHeight: "860px",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(232, 168, 56, 0.2)",
        overflow: "hidden"
      }}>
        
        {/* 1. Header & Multi-Agent Swarm Telemetry */}
        <div style={{
          padding: "16px 20px",
          background: "linear-gradient(180deg, #1E293B 0%, #0F172A 100%)",
          borderBottom: "1px solid #334155",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{
                background: "linear-gradient(135deg, #E8A838 0%, #B45309 100%)",
                width: 38,
                height: 38,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0F172A",
                fontWeight: 900,
                boxShadow: "0 4px 12px rgba(232, 168, 56, 0.3)"
              }}>
                <Sparkles size={20} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#F8FAFC" }}>
                    Add Items to Indent
                  </h2>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    background: "#059669",
                    color: "#FFFFFF",
                    padding: "2px 8px",
                    borderRadius: "20px",
                    letterSpacing: "0.03em"
                  }}>
                    {dept || "GENERAL"}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#94A3B8" }}>
                  Real-time database catalog, live warehouse stock levels, and instant cost calculation.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: "#1E293B",
                border: "1px solid #334155",
                borderRadius: "8px",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#94A3B8",
                cursor: "pointer",
                transition: "all 0.15s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#FFFFFF"; e.currentTarget.style.borderColor = "#EF4444"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#94A3B8"; e.currentTarget.style.borderColor = "#334155"; }}
              title="Close modal (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Multi-Agent Telemetry Indicators */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "#1E293B55",
            padding: "5px 12px",
            borderRadius: "8px",
            fontSize: "11px",
            border: "1px solid #33415544"
          }}>
            <span style={{ color: "#E8A838", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <ShieldCheck size={13} /> Multi-Agent Swarm:
            </span>
            <span style={{ color: "#10B981", display: "inline-flex", alignItems: "center", gap: 3 }}>
              ● Agent Nexus (Catalog 863 SKUs)
            </span>
            <span style={{ color: "#60A5FA", display: "inline-flex", alignItems: "center", gap: 3 }}>
              ● Agent StockSense (Live Central Store)
            </span>
            <span style={{ color: "#F59E0B", display: "inline-flex", alignItems: "center", gap: 3 }}>
              ● Agent Predictor (Par Forecast)
            </span>
          </div>
        </div>

        {/* 2. Mode Selector Tabs */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid #334155",
          background: "#0B1120",
          padding: "0 16px"
        }}>
          <button
            onClick={() => setActiveTab("catalog")}
            style={{
              padding: "12px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "catalog" ? "2px solid #E8A838" : "2px solid transparent",
              color: activeTab === "catalog" ? "#E8A838" : "#94A3B8",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <Search size={15} />
            Live Catalog & Search ({enrichedCatalog.length})
          </button>

          <button
            onClick={() => setActiveTab("recommendations")}
            style={{
              padding: "12px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "recommendations" ? "2px solid #E8A838" : "2px solid transparent",
              color: activeTab === "recommendations" ? "#E8A838" : "#94A3B8",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <TrendingUp size={15} />
            ⚡ Multi-Agent Recommendations
          </button>

          <button
            onClick={() => setActiveTab("custom")}
            style={{
              padding: "12px 18px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "custom" ? "2px solid #E8A838" : "2px solid transparent",
              color: activeTab === "custom" ? "#E8A838" : "#94A3B8",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <FilePlus size={15} />
            ✨ Custom / Special Request Item
          </button>
        </div>

        {/* 3. Tab Contents */}
        {activeTab === "catalog" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            
            {/* Search & Filters Ribbon */}
            <div style={{ padding: "14px 20px", background: "#1E293B44", borderBottom: "1px solid #334155", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search size={16} color="#64748B" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by item name, Telugu/Hindi alias, or SKU code (e.g. Tomato, KPL-468)..."
                    style={{
                      width: "100%",
                      padding: "10px 36px 10px 38px",
                      background: "#0F172A",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#F8FAFC",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        color: "#94A3B8",
                        cursor: "pointer"
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filters Toggle */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setDeptOnly(!deptOnly)}
                    style={{
                      background: deptOnly ? "#05966922" : "#1E293B",
                      border: `1px solid ${deptOnly ? "#10B981" : "#334155"}`,
                      color: deptOnly ? "#34D399" : "#94A3B8",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      whiteSpace: "nowrap"
                    }}
                    title="Toggle department pre-printed catalog only"
                  >
                    ⭐ {dept || "Dept"} Items Only
                  </button>

                  <button
                    onClick={() => setInStockOnly(!inStockOnly)}
                    style={{
                      background: inStockOnly ? "#05966922" : "#1E293B",
                      border: `1px solid ${inStockOnly ? "#10B981" : "#334155"}`,
                      color: inStockOnly ? "#34D399" : "#94A3B8",
                      borderRadius: "8px",
                      padding: "8px 14px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      whiteSpace: "nowrap"
                    }}
                  >
                    🟢 In Stock Only
                  </button>
                </div>
              </div>

              {/* Category Pills */}
              <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
                {CATEGORIES.map(cat => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      style={{
                        background: isActive ? "#E8A838" : "#1E293B",
                        color: isActive ? "#0F172A" : "#94A3B8",
                        border: `1px solid ${isActive ? "#E8A838" : "#334155"}`,
                        borderRadius: "20px",
                        padding: "5px 12px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s"
                      }}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Catalog Item Cards Grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {filteredCatalog.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#94A3B8" }}>
                  <Package size={40} color="#475569" style={{ marginBottom: 12 }} />
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#E2E8F0" }}>No matching catalog items found</p>
                  <p style={{ fontSize: "12px" }}>
                    Try broadening your search or check "✨ Custom / Special Request Item" to add an uncataloged item.
                  </p>
                  {deptOnly && (
                    <button
                      onClick={() => setDeptOnly(false)}
                      style={{
                        marginTop: 12,
                        background: "#E8A838",
                        color: "#0F172A",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 16px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      Browse Entire Central Store Catalog
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {filteredCatalog.map(item => {
                    const key = item.name.toLowerCase().trim();
                    const selected = selectedQuantities[key];
                    const selectedQty = selected ? selected.qty : 0;
                    const existingQty = existingItemsMap[key] || 0;
                    const isOutStock = item.remaining <= 0;
                    const isLowStock = item.remaining > 0 && item.remaining <= item.min_alert_qty;

                    return (
                      <div
                        key={item.item_code || item.name}
                        style={{
                          background: selectedQty > 0 ? "#1E293B" : "#131E32",
                          border: `1px solid ${selectedQty > 0 ? "#10B981" : "#334155"}`,
                          borderRadius: "12px",
                          padding: "12px 14px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "10px",
                          transition: "all 0.15s",
                          boxShadow: selectedQty > 0 ? "0 0 14px rgba(16, 185, 129, 0.15)" : "none"
                        }}
                      >
                        {/* Top: Name, Badges, SKU, and Rates */}
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: "14px", fontWeight: 700, color: "#F8FAFC" }}>
                                  {item.name}
                                </span>
                                {item.isDeptItem && (
                                  <span style={{
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    background: "#05966933",
                                    color: "#34D399",
                                    border: "1px solid #05966966",
                                    padding: "1px 5px",
                                    borderRadius: "4px"
                                  }}>
                                    DEPT
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: "11px", color: "#64748B", fontFamily: "monospace" }}>
                                {item.item_code} · {item.unit}
                              </span>
                            </div>

                            {/* Catalog Rate */}
                            <div style={{ textAlign: "right" }}>
                              <span style={{ fontSize: "13px", fontWeight: 700, color: "#E8A838" }}>
                                ₹{item.rate > 0 ? item.rate.toFixed(2) : "0.00"}
                              </span>
                              <span style={{ display: "block", fontSize: "10px", color: "#94A3B8" }}>
                                per {item.unit}
                              </span>
                            </div>
                          </div>

                          {/* Live Warehouse Stock & Existing Indent Indicator */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                            <span style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: "6px",
                              background: isOutStock ? "#FEE2E222" : (isLowStock ? "#FEF3C722" : "#DCFCE722"),
                              color: isOutStock ? "#F87171" : (isLowStock ? "#FBBF24" : "#4ADE80"),
                              border: `1px solid ${isOutStock ? "#EF444455" : (isLowStock ? "#F59E0B55" : "#10B98155")}`
                            }}>
                              {isOutStock ? "✕ 0 Out of Stock" : (isLowStock ? `⚡ ${item.remaining} Low Stock` : `✓ ${item.remaining} In Stock`)}
                            </span>

                            {existingQty > 0 && (
                              <span style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "6px",
                                background: "#3B82F622",
                                color: "#60A5FA",
                                border: "1px solid #3B82F655"
                              }} title="Item already present in this indent">
                                In Indent: {existingQty} {item.unit}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom: Touch Stepper & Preset Quick Add */}
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: "8px",
                          borderTop: "1px solid #33415555"
                        }}>
                          {/* Presets Chips */}
                          <div style={{ display: "flex", gap: "4px" }}>
                            {[1, 5, 10, 25].map(chip => (
                              <button
                                key={chip}
                                onClick={() => handlePresetAdd(item, chip)}
                                style={{
                                  background: "#1E293B",
                                  border: "1px solid #334155",
                                  borderRadius: "6px",
                                  padding: "3px 7px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: "#CBD5E1",
                                  cursor: "pointer"
                                }}
                                title={`Add ${chip} ${item.unit}`}
                              >
                                +{chip}
                              </button>
                            ))}
                          </div>

                          {/* Stepper Controls */}
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <button
                              onClick={() => handleQuantityChange(item, -1)}
                              disabled={selectedQty <= 0}
                              style={{
                                background: selectedQty > 0 ? "#334155" : "#1E293B88",
                                border: "1px solid #475569",
                                color: selectedQty > 0 ? "#F8FAFC" : "#64748B",
                                width: 30,
                                height: 30,
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: selectedQty > 0 ? "pointer" : "not-allowed",
                                fontWeight: 900
                              }}
                            >
                              <Minus size={14} />
                            </button>

                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={selectedQty > 0 ? selectedQty : ""}
                              onChange={(e) => handleManualQuantityInput(item, e.target.value)}
                              placeholder="0"
                              style={{
                                width: "54px",
                                height: "30px",
                                background: "#0F172A",
                                border: `1px solid ${selectedQty > 0 ? "#10B981" : "#334155"}`,
                                borderRadius: "6px",
                                color: selectedQty > 0 ? "#34D399" : "#F8FAFC",
                                fontWeight: 700,
                                textAlign: "center",
                                fontSize: "13px",
                                outline: "none"
                              }}
                            />

                            <button
                              onClick={() => handleQuantityChange(item, 1)}
                              style={{
                                background: "#E8A838",
                                border: "1px solid #E8A838",
                                color: "#0F172A",
                                width: 30,
                                height: 30,
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                fontWeight: 900
                              }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Line Subtotal when selected */}
                        {selectedQty > 0 && item.rate > 0 && (
                          <div style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: "#10B981",
                            textAlign: "right",
                            paddingTop: "2px"
                          }}>
                            Subtotal: ₹{(selectedQty * item.rate).toFixed(2)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Recommendations */}
        {activeTab === "recommendations" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#F8FAFC" }}>
                  Historical Weekday Requisitions for {dept}
                </h3>
                <p style={{ margin: 0, fontSize: "12px", color: "#94A3B8" }}>
                  Analyzed by Agent Predictor based on moving 4-week weekday consumption patterns.
                </p>
              </div>

              {recommendations.length > 0 && (
                <button
                  onClick={() => {
                    recommendations.forEach(rec => {
                      if (rec.avg_qty > 0) {
                        handlePresetAdd({
                          name: rec.name,
                          unit: rec.unit,
                          item_code: rec.item_code,
                          rate: 0
                        }, rec.avg_qty);
                      }
                    });
                  }}
                  style={{
                    background: "#059669",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <Zap size={14} /> Adopt All Par Quantities
                </button>
              )}
            </div>

            {loadingRecs ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94A3B8" }}>
                <RefreshCw size={32} className="spin" style={{ animation: "spin 1s linear infinite", marginBottom: 10 }} />
                <p>Agent Predictor is calculating moving weekday trends...</p>
              </div>
            ) : recommendations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94A3B8" }}>
                <TrendingUp size={36} color="#475569" style={{ marginBottom: 10 }} />
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#E2E8F0" }}>No Historical Requisition Pattern Yet</p>
                <p style={{ fontSize: "12px" }}>As indents are fulfilled throughout the month, Agent Predictor automatically populates weekday par suggestions here.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {recommendations.map(rec => {
                  const key = rec.name.toLowerCase().trim();
                  const selectedQty = selectedQuantities[key]?.qty || 0;

                  return (
                    <div
                      key={rec.name}
                      style={{
                        background: "#1E293B",
                        border: "1px solid #334155",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#F8FAFC" }}>{rec.name}</span>
                          <span style={{ fontSize: "11px", color: "#94A3B8", fontFamily: "monospace" }}>{rec.item_code}</span>
                        </div>
                        <div style={{ display: "flex", gap: "10px", marginTop: "4px", fontSize: "12px", color: "#64748B" }}>
                          <span>Ordered {rec.occurrence_count || 4} of past 4 weeks</span>
                          <span>•</span>
                          <span style={{ color: "#E8A838", fontWeight: 600 }}>Par Avg: {rec.avg_qty} {rec.unit}</span>
                          {rec.available_stock !== null && (
                            <>
                              <span>•</span>
                              <span style={{ color: rec.available_stock > 0 ? "#10B981" : "#EF4444" }}>
                                Live Stock: {rec.available_stock} {rec.unit}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {selectedQty > 0 && (
                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#34D399" }}>
                            Added: {selectedQty} {rec.unit}
                          </span>
                        )}
                        <button
                          onClick={() => handlePresetAdd({
                            name: rec.name,
                            unit: rec.unit,
                            item_code: rec.item_code,
                            rate: 0
                          }, rec.avg_qty)}
                          style={{
                            background: "#E8A838",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 14px",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#0F172A",
                            cursor: "pointer"
                          }}
                        >
                          + Apply Par ({rec.avg_qty})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Custom / Special Request Item */}
        {activeTab === "custom" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 30px" }}>
            <div style={{ maxWidth: "600px", margin: "0 auto" }}>
              <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#F8FAFC" }}>
                Add Custom / Emergency Kitchen Item
              </h3>
              <p style={{ margin: "0 0 20px", fontSize: "12px", color: "#94A3B8" }}>
                Use this for special requisitions, banquet off-catalog ingredients, or urgent kitchen items.
              </p>

              {customError && (
                <div style={{
                  background: "#FEE2E222",
                  border: "1px solid #EF444466",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#F87171",
                  fontSize: "12px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  <AlertTriangle size={16} /> {customError}
                </div>
              )}

              <form onSubmit={handleCustomSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E2E8F0", marginBottom: "6px" }}>
                    Item Name <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customForm.name}
                    onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
                    placeholder="e.g. Dragon Fruit, Kaffir Lime Leaves, Saffron Strings..."
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      background: "#1E293B",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#F8FAFC",
                      fontSize: "13px",
                      boxSizing: "border-box"
                    }}
                  />
                  {matchedStock && (
                    <div style={{ marginTop: "6px", fontSize: "11px", color: "#60A5FA", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Info size={13} />
                      Matched warehouse item: <strong>{matchedStock.name}</strong> ({matchedStock.item_code || "KPL"}) — Stock base unit: <strong>{matchedStock.unit}</strong>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E2E8F0", marginBottom: "6px" }}>
                      Requested Quantity <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      required
                      value={customForm.qty}
                      onChange={(e) => setCustomForm({ ...customForm, qty: e.target.value })}
                      placeholder="e.g. 5"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "#1E293B",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#F8FAFC",
                        fontSize: "13px",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E2E8F0", marginBottom: "6px" }}>
                      Unit <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <select
                      value={customForm.unit}
                      onChange={(e) => setCustomForm({ ...customForm, unit: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "#1E293B",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#F8FAFC",
                        fontSize: "13px",
                        boxSizing: "border-box"
                      }}
                    >
                      {customAllowedUnits.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E2E8F0", marginBottom: "6px" }}>
                      Estimated Unit Cost (₹ Optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={customForm.price}
                      onChange={(e) => setCustomForm({ ...customForm, price: e.target.value })}
                      placeholder="e.g. 150.00"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "#1E293B",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#F8FAFC",
                        fontSize: "13px",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E2E8F0", marginBottom: "6px" }}>
                      Urgency Level
                    </label>
                    <select
                      value={customForm.urgency}
                      onChange={(e) => setCustomForm({ ...customForm, urgency: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "#1E293B",
                        border: "1px solid #334155",
                        borderRadius: "8px",
                        color: "#F8FAFC",
                        fontSize: "13px",
                        boxSizing: "border-box"
                      }}
                    >
                      <option value="routine">Routine (Next-Day Service)</option>
                      <option value="urgent">⚡ Urgent (Service Preparation)</option>
                      <option value="emergency">🚨 Critical Emergency</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#E2E8F0", marginBottom: "6px" }}>
                    Kitchen Notes / Justification
                  </label>
                  <textarea
                    rows={2}
                    value={customForm.notes}
                    onChange={(e) => setCustomForm({ ...customForm, notes: e.target.value })}
                    placeholder="e.g. Required for VIP banquet dinner in Crystal Hall tomorrow night..."
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      background: "#1E293B",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#F8FAFC",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      resize: "none"
                    }}
                  />
                </div>

                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  background: "#1E293B44",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #334155"
                }}>
                  <input
                    type="checkbox"
                    checked={customForm.saveToTemplate}
                    onChange={(e) => setCustomForm({ ...customForm, saveToTemplate: e.target.checked })}
                    style={{ cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "12px", color: "#CBD5E1", fontWeight: 500 }}>
                    Permanently save to <strong>{dept || "Department"}</strong> pre-printed database template
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={savingCustom}
                  style={{
                    background: "linear-gradient(135deg, #E8A838 0%, #D97706 100%)",
                    color: "#0F172A",
                    border: "none",
                    borderRadius: "8px",
                    padding: "12px 20px",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: savingCustom ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    marginTop: "10px",
                    boxShadow: "0 4px 12px rgba(232, 168, 56, 0.3)"
                  }}
                >
                  <Plus size={16} />
                  {savingCustom ? "Processing Custom Item..." : "Add Special Request Item to Indent"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 4. Sticky Footer with Total Calculation and Primary Action */}
        <div style={{
          padding: "14px 24px",
          background: "#1E293B",
          borderTop: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#F8FAFC" }}>
                {selectedCount} {selectedCount === 1 ? "Item" : "Items"} Selected
              </span>
              {totalEstimatedCost > 0 && (
                <>
                  <span style={{ color: "#64748B" }}>•</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#10B981" }}>
                    Est. Total: ₹{totalEstimatedCost.toFixed(2)}
                  </span>
                </>
              )}
            </div>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94A3B8" }}>
              Items will be cleanly merged into the active indent with real-time central store stock verification.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {selectedCount > 0 && (
              <button
                onClick={() => setSelectedQuantities({})}
                style={{
                  background: "transparent",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  color: "#94A3B8",
                  padding: "8px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Clear
              </button>
            )}

            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "1px solid #475569",
                borderRadius: "8px",
                color: "#E2E8F0",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleConfirmAdd}
              disabled={selectedCount === 0}
              style={{
                background: selectedCount > 0
                  ? "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                  : "#334155",
                color: selectedCount > 0 ? "#FFFFFF" : "#94A3B8",
                border: "none",
                borderRadius: "8px",
                padding: "9px 20px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: selectedCount > 0 ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: selectedCount > 0 ? "0 4px 14px rgba(16, 185, 129, 0.4)" : "none",
                transition: "all 0.15s"
              }}
            >
              <Check size={16} />
              Add {selectedCount} {selectedCount === 1 ? "Item" : "Items"} to Indent
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
