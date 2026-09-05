import { useState, useEffect, useMemo } from "react";
import Card from "../../../components/Card";
import * as api from "../../../api";
import CompilePreviewModal from "./CompilePreviewModal";
import CreateDishModal from "./CreateDishModal";
import {
  Sparkles, RefreshCw, Trash2, Check,
  TrendingUp, Clock, Search, AlertTriangle,
  ArrowUpDown, Star, Plus,
} from "lucide-react";

/* ─── constants ─────────────────────────────────────────────────────────────── */
const CONFIDENCE = (item) => {
  const freq  = item.frequency_pct || 0;
  const trend = item.trend_direction;
  if (freq >= 0.75 && trend !== "down") return "HIGH";
  if (freq >= 0.50)                     return "MEDIUM";
  return "LOW";
};
const CONF_STYLE = {
  HIGH:   { bg: "#DCFCE7", color: "#15803D", label: "HIGH", order: 0 },
  MEDIUM: { bg: "#FEF9C3", color: "#A16207", label: "MED",  order: 1 },
  LOW:    { bg: "#FEE2E2", color: "#B91C1C", label: "LOW",  order: 2 },
};
const TREND_ARROW = (dir) => {
  if (dir === "up")   return { arrow: "↑", color: "#10B981", tip: "Increasing trend" };
  if (dir === "down") return { arrow: "↓", color: "#EF4444", tip: "Decreasing trend" };
  return                     { arrow: "→", color: "#94A3B8", tip: "Stable trend" };
};

const PLATE_PRESETS  = [50, 100, 150, 200];
const CATEGORY_ALL   = "All";
const WEEKS_OPTIONS  = [2, 4, 6, 8, 12];
const RECENT_MAX     = 5;
const RECENT_KEY     = "kapila_recent_recipes";

/* ─── persistence helpers ───────────────────────────────────────────────────── */
const draftKey = (dept) => `kapila_smart_indent_draft_${dept}`;

const saveDraft = (dept, plannedRecipes, selectedItems, quantities, adHocItems) => {
  try {
    localStorage.setItem(draftKey(dept), JSON.stringify({
      plannedRecipes: plannedRecipes.map(({ recipe, plates }) => ({
        recipe: { id: recipe.id, name: recipe.name, category: recipe.category, base_plates: recipe.base_plates, items: recipe.items },
        plates,
      })),
      selectedItems,
      quantities,
      adHocItems,
    }));
  } catch {}
};

const loadDraft = (dept) => {
  try {
    const raw = localStorage.getItem(draftKey(dept));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const clearDraft = (dept) => {
  try { localStorage.removeItem(draftKey(dept)); } catch {}
};

const loadRecentRecipes = () => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const persistRecentRecipes = (list) => {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); } catch {}
};

/* ─── stock helpers ──────────────────────────────────────────────────────────── */
const getIngredientStatus = (itemName, scaledQty, stockMap) => {
  const entry = stockMap[itemName.trim().toLowerCase()];
  if (!entry) return "unknown";
  const avail = parseFloat(entry.remaining || 0);
  if (avail >= scaledQty) return "ok";
  if (avail > 0)           return "low";
  return "out";
};

const ING_STYLE = {
  ok:      { color: "#065F46", bg: "#F0FDF4", dot: "#10B981" },
  low:     { color: "#92400E", bg: "#FFFBEB", dot: "#F59E0B" },
  out:     { color: "#991B1B", bg: "#FEF2F2", dot: "#EF4444" },
  unknown: { color: "#1E293B", bg: "transparent", dot: "transparent" },
};

const getRecipeCoverage = (recipe, plates, stockMap) => {
  const items = recipe.items || [];
  if (!items.length) return null;
  const factor = plates / (recipe.base_plates || 100);
  const covered = items.filter((it) =>
    getIngredientStatus(it.item_name, it.base_qty * factor, stockMap) === "ok"
  ).length;
  return { covered, total: items.length };
};

const sourceBadge = (source) => {
  if (source === "both")   return { label: "R+T", bg: "#EDE9FE", color: "#6D28D9" };
  if (source === "recipe") return { label: "R",   bg: "#DBEAFE", color: "#1D4ED8" };
  return                          { label: "T",   bg: "#D1FAE5", color: "#065F46" };
};

/* ─── COMPONENT ──────────────────────────────────────────────────────────────── */
export default function SmartIndentTab({ dept, date, stocks = [], onCompile, onSubmitSuccess }) {

  /* ── Recipe state ── */
  const [recipesList, setRecipesList]       = useState([]);
  const [plannedRecipes, setPlannedRecipes] = useState([]);
  const [recipeSearch, setRecipeSearch]     = useState("");
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_ALL);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [recentRecipes, setRecentRecipes]   = useState(() => loadRecentRecipes());
  const [expirySuggestions, setExpirySuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  /* ── Trend state ── */
  const [trendData, setTrendData]                   = useState([]);
  const [selectedTrendItems, setSelectedTrendItems] = useState({});
  const [trendQuantities, setTrendQuantities]       = useState({});
  const [loadingTrend, setLoadingTrend]             = useState(false);
  const [weeks, setWeeks]                           = useState(4);
  const [trendSort, setTrendSort]                   = useState("confidence"); // confidence | qty | name
  const [trendSearch, setTrendSearch]               = useState("");

  /* ── UI state ── */
  const [showPreview, setShowPreview] = useState(false);
  const [showCreateDish, setShowCreateDish] = useState(false);
  const [msg, setMsg]                 = useState("");
  const [hasDraft, setHasDraft]       = useState(false);
  const [draftTime, setDraftTime]     = useState(null);

  /* ── Ad-hoc Items ── */
  const [adHocItems, setAdHocItems] = useState([]);

  /* ─────── Derived stock map ─────────────────────────────────────────────── */
  const stockMap = useMemo(
    () => Object.fromEntries(stocks.map((s) => [s.name.toLowerCase(), s])),
    [stocks]
  );

  /* ─────── Load recipes once ─────────────────────────────────────────────── */
  useEffect(() => {
    setLoadingRecipes(true);
    api.recipes.list()
      .then((res) => { if (res.success) setRecipesList(res.data || []); })
      .catch(() => {})
      .finally(() => setLoadingRecipes(false));

    setLoadingSuggestions(true);
    api.recipes.expirySuggestions()
      .then((res) => {
        if (res.success) {
          setExpirySuggestions(res.data || []);
        }
      })
      .catch((err) => console.error("Error fetching suggestions:", err))
      .finally(() => setLoadingSuggestions(false));
  }, []);

  /* ─────── Load draft on dept change ────────────────────────────────────── */
  useEffect(() => {
    if (!dept) return;
    const draft = loadDraft(dept);
    if (draft) {
      setPlannedRecipes(draft.plannedRecipes || []);
      setSelectedTrendItems(draft.selectedItems || {});
      setTrendQuantities(draft.quantities || {});
      setAdHocItems(draft.adHocItems || []);
      setHasDraft(true);
      setDraftTime(new Date());
    } else {
      setPlannedRecipes([]);
      setAdHocItems([]);
      setHasDraft(false);
      setDraftTime(null);
    }
  }, [dept]);

  /* ─────── Load trend data ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!dept) return;
    setLoadingTrend(true);
    api.indents.recommendations({ dept, date, weeks })
      .then((res) => {
        if (res.success) {
          const data = res.data || [];
          setTrendData(data);
          const initSel = {};
          const initQty = {};
          data.forEach((item) => {
            initSel[item.name] = true;
            initQty[item.name] = item.avg_qty.toString();
          });
          setSelectedTrendItems(initSel);
          setTrendQuantities(initQty);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTrend(false));
  }, [dept, date, weeks]);

  /* ─────── Auto-save draft ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!dept) return;
    saveDraft(dept, plannedRecipes, selectedTrendItems, trendQuantities, adHocItems);
    if (plannedRecipes.length > 0 || adHocItems.length > 0) {
      setHasDraft(true);
      setDraftTime(new Date());
    }
  }, [dept, plannedRecipes, selectedTrendItems, trendQuantities, adHocItems]);

  /* ─────── Derived: categories ───────────────────────────────────────────── */
  const categories = useMemo(() => {
    const cats = [...new Set(recipesList.map((r) => r.category).filter(Boolean))].sort();
    return [CATEGORY_ALL, ...cats];
  }, [recipesList]);

  /* ─────── Derived: filtered recipe search results ───────────────────────── */
  const filteredRecipes = useMemo(() =>
    recipesList.filter((r) => {
      const matchSearch   = r.name.toLowerCase().includes(recipeSearch.toLowerCase()) ||
                            r.category.toLowerCase().includes(recipeSearch.toLowerCase());
      const matchCategory = categoryFilter === CATEGORY_ALL || r.category === categoryFilter;
      return matchSearch && matchCategory;
    }),
    [recipesList, recipeSearch, categoryFilter]
  );

  /* ─────── Derived: sorted + filtered trend data ─────────────────────────── */
  const sortedTrendData = useMemo(() => {
    let data = trendSearch
      ? trendData.filter((i) => i.name.toLowerCase().includes(trendSearch.toLowerCase()))
      : trendData;
    if (trendSort === "confidence") {
      data = [...data].sort((a, b) => CONF_STYLE[CONFIDENCE(a)].order - CONF_STYLE[CONFIDENCE(b)].order);
    } else if (trendSort === "qty") {
      data = [...data].sort((a, b) => (b.avg_qty || 0) - (a.avg_qty || 0));
    } else if (trendSort === "name") {
      data = [...data].sort((a, b) => a.name.localeCompare(b.name));
    }
    return data;
  }, [trendData, trendSort, trendSearch]);

  /* ─────── Derived: live merged ingredient list ──────────────────────────── */
  const livePreview = useMemo(() => {
    const merged = {};

    plannedRecipes.forEach(({ recipe, plates }) => {
      const factor = plates / (recipe.base_plates || 100);
      (recipe.items || []).forEach((item) => {
        const key = item.item_name.trim().toLowerCase();
        if (!merged[key]) merged[key] = { name: item.item_name.trim(), qty: 0, unit: item.unit, source: "recipe" };
        merged[key].qty += item.base_qty * factor;
        merged[key].source = merged[key].source === "trend" ? "both" : "recipe";
      });
    });

    trendData.forEach((item) => {
      if (!selectedTrendItems[item.name]) return;
      const qty = parseFloat(trendQuantities[item.name]) || 0;
      if (qty <= 0) return;
      const key = item.name.trim().toLowerCase();
      if (!merged[key]) merged[key] = { name: item.name.trim(), qty: 0, unit: item.unit, source: "trend" };
      merged[key].qty += qty;
      merged[key].source = merged[key].source === "recipe" ? "both" : "trend";
    });

    adHocItems.forEach((item) => {
      const qty = parseFloat(item.qty) || 0;
      if (qty <= 0) return;
      const key = item.name.trim().toLowerCase();
      if (!merged[key]) merged[key] = { name: item.name.trim(), qty: 0, unit: item.unit, source: "ad-hoc" };
      merged[key].qty += qty;
    });

    return Object.values(merged).map((it) => ({ ...it, qty: Math.round(it.qty * 100) / 100 }));
  }, [plannedRecipes, trendData, selectedTrendItems, trendQuantities, adHocItems]);

  /* ─────── Derived: stock warnings for compile bar ───────────────────────── */
  const stockWarnings = useMemo(() => {
    let low = 0, out = 0;
    livePreview.forEach((item) => {
      const entry = stockMap[item.name.toLowerCase()];
      if (!entry) return;
      const avail = parseFloat(entry.remaining || 0);
      if (avail <= 0)         out++;
      else if (avail < item.qty) low++;
    });
    return { low, out };
  }, [livePreview, stockMap]);

  /* ─────── Recipe actions ────────────────────────────────────────────────── */
  const handleAddRecipe = (recipe) => {
    if (plannedRecipes.some((pr) => pr.recipe.id === recipe.id)) return;
    setPlannedRecipes((prev) => [...prev, { recipe, plates: recipe.base_plates || 100 }]);
    setRecipeSearch("");
    // Persist to recent
    setRecentRecipes((prev) => {
      const next = [{ id: recipe.id, name: recipe.name, category: recipe.category }, ...prev.filter((r) => r.id !== recipe.id)].slice(0, RECENT_MAX);
      persistRecentRecipes(next);
      return next;
    });
  };

  const handleAddSuggestion = (recipeId) => {
    const recipe = recipesList.find(r => r.id === recipeId);
    if (recipe) {
      handleAddRecipe(recipe);
    }
  };

  const handleAIAutoFill = async () => {
    if (plannedRecipes.length === 0) {
      alert("Please add planned recipes/dishes first before autofilling.");
      return;
    }
    setLoadingSuggestions(true);
    try {
      const res = await api.indents.smartAutofill({
        dept,
        plannedRecipes: plannedRecipes.map(pr => ({ id: pr.recipe.id, plates: pr.plates }))
      });
      if (res.success && res.data) {
        const newSelectedTrends = {};
        const newQuantities = {};
        res.data.forEach(item => {
          newSelectedTrends[item.name] = true;
          newQuantities[item.name] = item.qty.toString();
        });
        
        setSelectedTrendItems(prev => ({
          ...prev,
          ...newSelectedTrends
        }));
        setTrendQuantities(prev => ({
          ...prev,
          ...newQuantities
        }));

        alert("AI successfully calculated indent quantities by scaling recipes and deducting kitchen leftovers!");
      }
    } catch (err) {
      console.error("AI Auto-fill failed", err);
      alert("AI Auto-fill failed.");
    }
    setLoadingSuggestions(false);
  };

  const handleRemoveRecipe = (id) =>
    setPlannedRecipes((prev) => prev.filter((pr) => pr.recipe.id !== id));

  const handlePlatesChange = (id, val) =>
    setPlannedRecipes((prev) =>
      prev.map((pr) => pr.recipe.id === id ? { ...pr, plates: Math.max(1, parseInt(val) || 0) } : pr)
    );

  const handlePlatesStep = (id, delta) =>
    setPlannedRecipes((prev) =>
      prev.map((pr) => pr.recipe.id === id ? { ...pr, plates: Math.max(1, pr.plates + delta) } : pr)
    );

  /* ─────── Trend actions ─────────────────────────────────────────────────── */
  const handleToggleTrendItem = (name) =>
    setSelectedTrendItems((prev) => ({ ...prev, [name]: !prev[name] }));

  const handleTrendQtyChange = (name, val) =>
    setTrendQuantities((prev) => ({ ...prev, [name]: val }));

  const handleSelectAll   = () => setSelectedTrendItems(Object.fromEntries(trendData.map((i) => [i.name, true])));
  const handleDeselectAll = () => setSelectedTrendItems(Object.fromEntries(trendData.map((i) => [i.name, false])));

  /* ─────── Compile ───────────────────────────────────────────────────────── */
  const handleOpenPreview = () => {
    if (livePreview.length === 0) {
      setMsg("Add some dishes or trend items first.");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    const compiled = livePreview.map((item) => {
      const match = stockMap[item.name.toLowerCase()];
      return {
        name:      item.name,
        qty:       item.qty.toString(),
        unit:      match?.unit || item.unit || "kg",
        item_code: match?.item_code || "KPL-NEW",
        source:    item.source,
      };
    });
    onCompile(compiled);
    setShowPreview(true);
  };

  /* ─────── Reset ─────────────────────────────────────────────────────────── */
  const handleReset = () => {
    setPlannedRecipes([]);
    setSelectedTrendItems(Object.fromEntries(trendData.map((i) => [i.name, true])));
    setTrendQuantities(Object.fromEntries(trendData.map((i) => [i.name, i.avg_qty.toString()])));
    clearDraft(dept);
    setHasDraft(false);
    setDraftTime(null);
  };

  /* ─────── Utilities ─────────────────────────────────────────────────────── */
  const weekdayName = (() => {
    try {
      const d = new Date(date);
      return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { weekday: "long" });
    } catch { return ""; }
  })();

  const draftAgo = draftTime
    ? (() => {
        const diff = Math.floor((Date.now() - draftTime.getTime()) / 1000);
        if (diff < 60)   return "just now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
      })()
    : null;

  const selectedTrendCount = Object.values(selectedTrendItems).filter(Boolean).length;

  /* ══════════════════════════════ RENDER ══════════════════════════════════════ */
  return (
    <div className="smart-indent-layout">

      {/* ═══ LEFT: Dish & Recipe Planner ════════════════════════════════════ */}
      <div className="smart-column">
        <Card style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px", minHeight: 520, display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={18} color="#e8a838" />
              <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", color: "#1E293B", textTransform: "uppercase", margin: 0 }}>
                1. Dish & Recipe Planner
              </h3>
            </div>
            {plannedRecipes.length > 0 && (
              <span style={{ fontSize: 11, background: "#e8a83820", color: "#e8a838", fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>
                {plannedRecipes.length} dish{plannedRecipes.length !== 1 ? "es" : ""}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 14 }}>
            Add planned dishes and set portion counts — ingredients scale automatically.
          </p>

          {/* Category filter chips */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} style={{
                padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${categoryFilter === cat ? "#e8a838" : "#E2E8F0"}`,
                background: categoryFilter === cat ? "#e8a838" : "white",
                color: categoryFilter === cat ? "#1E293B" : "#64748B",
                transition: "all 0.15s",
              }}>{cat}</button>
            ))}
          </div>

          {/* ── Recently used recipes shelf ── */}
          {recentRecipes.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                <Clock size={11} color="#94A3B8" />
                <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", letterSpacing: "0.04em", textTransform: "uppercase" }}>Recent</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {recentRecipes.map((r) => {
                  const full    = recipesList.find((rl) => rl.id === r.id);
                  const isAdded = plannedRecipes.some((pr) => pr.recipe.id === r.id);
                  return (
                    <button key={r.id}
                      onClick={() => full && !isAdded && handleAddRecipe(full)}
                      disabled={!full || isAdded}
                      style={{
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                        border: `1px solid ${isAdded ? "#10B98133" : "#E2E8F0"}`,
                        background: isAdded ? "#F0FDF4" : "#F8FAFC",
                        color: isAdded ? "#10B981" : "#475569",
                        cursor: full && !isAdded ? "pointer" : "default",
                        display: "flex", alignItems: "center", gap: 4,
                        opacity: full ? 1 : 0.4,
                      }}>
                      {isAdded
                        ? <Check size={10} />
                        : <Star size={10} fill="#e8a838" color="#e8a838" />
                      }
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expiry-Aware Menu Suggestions */}
          {expirySuggestions.length > 0 && (
            <div style={{
              background: "linear-gradient(135deg, #FFFDF5 0%, #FFFBEB 100%)",
              border: "1px solid #F59E0B",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              boxShadow: "0 2px 8px rgba(245, 158, 11, 0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Sparkles size={16} color="#e8a838" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Expiry-Aware Recommendations
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {expirySuggestions.map((sug, i) => {
                  const alreadyPlanned = plannedRecipes.some(pr => pr.recipe.id === sug.recipe_id);
                  return (
                    <div key={i} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 12,
                      color: "#78350F",
                      padding: "8px 10px",
                      background: "rgba(255, 255, 255, 0.6)",
                      borderRadius: 8,
                      border: "1px solid rgba(245, 158, 11, 0.2)"
                    }}>
                      <div style={{ flex: 1, paddingRight: 8 }}>
                        <strong>{sug.recipe_name}</strong>: {sug.suggestion}
                      </div>
                      <button
                        onClick={() => handleAddSuggestion(sug.recipe_id)}
                        disabled={alreadyPlanned}
                        style={{
                          background: alreadyPlanned ? "#F3F4F6" : "#e8a838",
                          color: alreadyPlanned ? "#9CA3AF" : "#1E293B",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: alreadyPlanned ? "default" : "pointer",
                          transition: "all 0.15s ease",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {alreadyPlanned ? "Planned" : "+ Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recipe search */}
          <div style={{ position: "relative", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder="Search recipes to add to today's menu…"
                style={{ flex: 1, padding: "9px 14px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
              <button
                onClick={() => setShowCreateDish(true)}
                style={{
                  background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 8, padding: "0 12px",
                  fontSize: 12, fontWeight: 700, color: "#475569", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap"
                }}
              >
                <Plus size={14} /> New Dish
              </button>
              <button
                onClick={handleAIAutoFill}
                disabled={loadingSuggestions || plannedRecipes.length === 0}
                style={{
                  background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                  border: "1px solid #e8a838",
                  borderRadius: 8,
                  padding: "0 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#e8a838",
                  cursor: (loadingSuggestions || plannedRecipes.length === 0) ? "default" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                  opacity: (loadingSuggestions || plannedRecipes.length === 0) ? 0.5 : 1,
                  boxShadow: "0 2px 8px rgba(232, 168, 56, 0.15)"
                }}
              >
                <Sparkles size={14} color="#e8a838" />
                {loadingSuggestions ? 'Auto-filling...' : 'AI Auto-Fill'}
              </button>
            </div>
            {recipeSearch && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.10)", zIndex: 100, maxHeight: 200, overflowY: "auto", marginTop: 4 }}>
                {loadingRecipes ? (
                  <div style={{ padding: "10px 14px", fontSize: 12, color: "#94A3B8" }}>Loading…</div>
                ) : filteredRecipes.length === 0 ? (
                  <div style={{ padding: "10px 14px", fontSize: 12, color: "#94A3B8" }}>No recipes found for "{recipeSearch}"</div>
                ) : filteredRecipes.map((r) => {
                  const isAdded = plannedRecipes.some((pr) => pr.recipe.id === r.id);
                  const cov     = getRecipeCoverage(r, r.base_plates || 100, stockMap);
                  return (
                    <div key={r.id} onClick={() => !isAdded && handleAddRecipe(r)} style={{
                      padding: "10px 14px", fontSize: 13, cursor: isAdded ? "default" : "pointer",
                      background: isAdded ? "#F8FAFC" : "white", color: isAdded ? "#94A3B8" : "#1E293B",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      borderBottom: "1px solid #F1F5F9",
                    }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{r.name}</span>
                        <span style={{ fontSize: 10, background: "#F1F5F9", color: "#64748B", padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>{r.category}</span>
                        {cov && (
                          <span style={{
                            fontSize: 10, marginLeft: 6, fontWeight: 700,
                            color: cov.covered === cov.total ? "#10B981" : cov.covered === 0 ? "#EF4444" : "#F59E0B",
                          }}>
                            {cov.covered}/{cov.total} in stock
                          </span>
                        )}
                      </div>
                      {isAdded
                        ? <span style={{ fontSize: 11, color: "#10B981", display: "flex", alignItems: "center", gap: 3 }}><Check size={11} /> Added</span>
                        : <span style={{ fontSize: 12, color: "#e8a838", fontWeight: 700 }}>+ Add</span>
                      }
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Filtered recipes grid (if category selected but no search) ── */}
          {!recipeSearch && categoryFilter !== CATEGORY_ALL && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, maxHeight: 200, overflowY: "auto", paddingRight: 4 }}>
                {filteredRecipes.map((r) => {
                  const isAdded = plannedRecipes.some((pr) => pr.recipe.id === r.id);
                  return (
                    <button key={r.id}
                      onClick={() => !isAdded && handleAddRecipe(r)}
                      disabled={isAdded}
                      style={{
                        padding: "8px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, textAlign: "left",
                        border: `1px solid ${isAdded ? "#10B98133" : "#E2E8F0"}`,
                        background: isAdded ? "#F0FDF4" : "#F8FAFC",
                        color: isAdded ? "#10B981" : "#1E293B",
                        cursor: isAdded ? "default" : "pointer",
                        display: "flex", flexDirection: "column", gap: 4,
                        transition: "all 0.15s"
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "flex-start" }}>
                        <span style={{ lineHeight: 1.2 }}>{r.name}</span>
                        {isAdded && <Check size={12} color="#10B981" style={{ flexShrink: 0 }} />}
                      </div>
                      <span style={{ fontSize: 10, color: isAdded ? "#10B98188" : "#94A3B8", fontWeight: 500 }}>
                        {r.base_plates || 100} plates base
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Planned recipe cards ── */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
            {plannedRecipes.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, border: "2px dashed #E2E8F0", borderRadius: 10, padding: "28px 16px", gap: 6 }}>
                <span style={{ fontSize: 28 }}>🍽️</span>
                <span style={{ color: "#94A3B8", fontSize: 13, textAlign: "center" }}>
                  No dishes planned yet.<br />Search above to add today's menu.
                </span>
              </div>
            ) : plannedRecipes.map(({ recipe, plates }) => {
              const factor = plates / (recipe.base_plates || 100);
              const cov    = getRecipeCoverage(recipe, plates, stockMap);
              return (
                <div key={recipe.id} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: "14px 16px", background: "#F8FAFC" }}>

                  {/* Title row */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", margin: 0 }}>{recipe.name}</h4>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 10, color: "#64748B" }}>{recipe.category} · base {recipe.base_plates || 100} plates</span>
                        {cov && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                            color: cov.covered === cov.total ? "#065F46" : cov.covered === 0 ? "#991B1B" : "#92400E",
                            background: cov.covered === cov.total ? "#D1FAE5" : cov.covered === 0 ? "#FEE2E2" : "#FEF3C7",
                          }}>
                            {cov.covered}/{cov.total} in stock
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => handleRemoveRecipe(recipe.id)}
                      style={{ background: "transparent", color: "#EF4444", border: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* ── Portions control: stepper + slider + presets ── */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>Portions / Plates</label>
                      {/* -25 -10 [input] +10 +25 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {[-25, -10].map((d) => (
                          <button key={d} onClick={() => handlePlatesStep(recipe.id, d)}
                            style={{ padding: "2px 7px", fontSize: 11, fontWeight: 700, border: "1px solid #E2E8F0", borderRadius: 5, background: "white", color: "#64748B", cursor: "pointer" }}>
                            {d}
                          </button>
                        ))}
                        <input
                          type="number" value={plates} min={1}
                          onChange={(e) => handlePlatesChange(recipe.id, e.target.value)}
                          style={{ width: 60, padding: "4px 6px", fontSize: 13, fontWeight: 700, border: "1px solid #CBD5E1", borderRadius: 6, textAlign: "center" }}
                        />
                        {[10, 25].map((d) => (
                          <button key={d} onClick={() => handlePlatesStep(recipe.id, d)}
                            style={{ padding: "2px 7px", fontSize: 11, fontWeight: 700, border: "1px solid #E2E8F0", borderRadius: 5, background: "white", color: "#64748B", cursor: "pointer" }}>
                            +{d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input type="range" min={1} max={500} value={plates}
                      onChange={(e) => handlePlatesChange(recipe.id, e.target.value)}
                      style={{ width: "100%", accentColor: "#e8a838", cursor: "pointer" }}
                    />
                    <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                      {PLATE_PRESETS.map((p) => (
                        <button key={p} onClick={() => handlePlatesChange(recipe.id, p)}
                          style={{ flex: 1, padding: "3px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 6, border: `1px solid ${plates === p ? "#e8a838" : "#E2E8F0"}`, background: plates === p ? "#FFF8E7" : "white", color: plates === p ? "#92400E" : "#64748B" }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── Scaled ingredients with stock colour-coding ── */}
                  <div style={{ background: "white", borderRadius: 6, border: "1px solid #E2E8F0", padding: "8px 12px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: 5, letterSpacing: "0.04em" }}>
                      Scaled Ingredients ({plates} plates):
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {(recipe.items || []).map((item) => {
                        const scaledQty = item.base_qty * factor;
                        const status    = getIngredientStatus(item.item_name, scaledQty, stockMap);
                        const st        = ING_STYLE[status];
                        return (
                          <div key={item.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            fontSize: 12, padding: "2px 6px", borderRadius: 4, background: st.bg,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {status !== "unknown" && (
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot, display: "inline-block", flexShrink: 0 }} />
                              )}
                              <span style={{ color: st.color }}>{item.item_name}</span>
                            </div>
                            <span style={{ fontWeight: 700, fontFamily: "monospace", color: st.color }}>
                              {scaledQty.toFixed(2)} {item.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Ad-Hoc Extra Items ── */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px dashed #E2E8F0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Plus size={16} color="#475569" />
              <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", margin: 0 }}>Ad-Hoc Extra Items</h4>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {adHocItems.map((item, idx) => (
                <div key={item.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    value={item.name}
                    onChange={(e) => setAdHocItems(prev => prev.map(it => it.id === item.id ? { ...it, name: e.target.value } : it))}
                    placeholder="Item name"
                    style={{ flex: 1, padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #CBD5E1", outline: "none" }}
                  />
                  <input
                    type="number"
                    value={item.qty}
                    onChange={(e) => setAdHocItems(prev => prev.map(it => it.id === item.id ? { ...it, qty: e.target.value } : it))}
                    placeholder="Qty"
                    min="0" step="0.1"
                    style={{ width: 60, padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #CBD5E1", outline: "none" }}
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => setAdHocItems(prev => prev.map(it => it.id === item.id ? { ...it, unit: e.target.value } : it))}
                    style={{ width: 60, padding: "6px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #CBD5E1", outline: "none", background: "white" }}
                  >
                    <option value="kg">kg</option>
                    <option value="ltr">ltr</option>
                    <option value="pcs">pcs</option>
                    <option value="pkt">pkt</option>
                    <option value="g">g</option>
                  </select>
                  <button onClick={() => setAdHocItems(prev => prev.filter(it => it.id !== item.id))} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => setAdHocItems(prev => [...prev, { id: Date.now(), name: "", qty: "", unit: "kg" }])} style={{ background: "none", border: "1px dashed #CBD5E1", color: "#64748B", borderRadius: 6, padding: "6px", fontSize: 11, fontWeight: 600, cursor: "pointer", textAlign: "center", transition: "all 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; e.currentTarget.style.color = "#1E293B"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#64748B"; }}>
                + Add Custom Item
              </button>
            </div>
          </div>

          {/* ── Live compiled total preview ── */}
          {livePreview.length > 0 && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", margin: "0 0 8px", letterSpacing: "0.04em" }}>
                ⚡ Live Compiled Total ({livePreview.length} items)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 130, overflowY: "auto" }}>
                {livePreview.map((it) => {
                  const sb = sourceBadge(it.source);
                  return (
                    <div key={it.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, background: sb.bg, color: sb.color, padding: "1px 4px", borderRadius: 3, letterSpacing: "0.02em" }}>
                          {sb.label}
                        </span>
                        <span style={{ color: "#166534", fontWeight: 500 }}>{it.name}</span>
                      </div>
                      <span style={{ fontWeight: 700, fontFamily: "monospace", color: "#14532D" }}>
                        {it.qty} {it.unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ═══ RIGHT: Trend-Based Predictor ═══════════════════════════════════ */}
      <div className="smart-column">
        <Card style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px", minHeight: 520, display: "flex", flexDirection: "column" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingUp size={18} color="#e8a838" />
              <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.06em", color: "#1E293B", textTransform: "uppercase", margin: 0 }}>
                2. Trend Predictor {weekdayName ? `— ${weekdayName}` : ""}
              </h3>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "#64748B", marginBottom: 10 }}>
            Historical averages for this weekday. Confidence = how often the item was ordered.
          </p>

          {/* Lookback weeks */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>Lookback:</span>
            <div style={{ display: "flex", gap: 4 }}>
              {WEEKS_OPTIONS.map((w) => (
                <button key={w} onClick={() => setWeeks(w)}
                  style={{ padding: "2px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 6, border: `1px solid ${weeks === w ? "#e8a838" : "#E2E8F0"}`, background: weeks === w ? "#FFF8E7" : "white", color: weeks === w ? "#92400E" : "#64748B" }}>
                  {w}w
                </button>
              ))}
            </div>
            {loadingTrend && (
              <div style={{ width: 14, height: 14, border: "2px solid #E2E8F0", borderTopColor: "#e8a838", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginLeft: "auto" }} />
            )}
          </div>

          {/* ── Search + Sort bar ── */}
          {trendData.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={12} color="#94A3B8" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input
                  value={trendSearch}
                  onChange={(e) => setTrendSearch(e.target.value)}
                  placeholder="Filter items…"
                  style={{ width: "100%", padding: "5px 10px 5px 26px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {[["confidence", "Conf"], ["qty", "Qty"], ["name", "A–Z"]].map(([key, label]) => (
                  <button key={key} onClick={() => setTrendSort(key)}
                    style={{
                      padding: "4px 9px", fontSize: 10, fontWeight: 700, cursor: "pointer",
                      border: `1px solid ${trendSort === key ? "#e8a838" : "#E2E8F0"}`,
                      borderRadius: 6,
                      background: trendSort === key ? "#FFF8E7" : "white",
                      color: trendSort === key ? "#92400E" : "#94A3B8",
                      display: "flex", alignItems: "center", gap: 3,
                    }}>
                    <ArrowUpDown size={9} />{label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Select All / Deselect All */}
          {trendData.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, color: "#64748B" }}>
                <strong>{selectedTrendCount}</strong> of {trendData.length} selected
                {trendSearch && <span style={{ color: "#e8a838" }}> · {sortedTrendData.length} shown</span>}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleSelectAll}
                  style={{ fontSize: 11, fontWeight: 600, color: "#2563EB", background: "transparent", border: "none", cursor: "pointer", padding: "2px 0" }}>
                  Select All
                </button>
                <span style={{ color: "#CBD5E1" }}>|</span>
                <button onClick={handleDeselectAll}
                  style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", background: "transparent", border: "none", cursor: "pointer", padding: "2px 0" }}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* ── Trend items list ── */}
          {loadingTrend ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ height: 48, background: "#F1F5F9", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : trendData.length === 0 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "2px dashed #E2E8F0", borderRadius: 10, padding: "28px 16px", gap: 6 }}>
              <span style={{ fontSize: 28 }}>📊</span>
              <span style={{ color: "#94A3B8", fontSize: 13, textAlign: "center" }}>
                No {weekdayName} data in the last {weeks} weeks.<br />
                <span style={{ fontSize: 12 }}>Indent history from this weekday will appear here over time.</span>
              </span>
            </div>
          ) : sortedTrendData.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 13 }}>
              No items match "{trendSearch}"
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
              {sortedTrendData.map((item) => {
                const isChecked  = !!selectedTrendItems[item.name];
                const conf       = CONFIDENCE(item);
                const cs         = CONF_STYLE[conf];
                const trendArrow = TREND_ARROW(item.trend_direction);
                const needed     = parseFloat(trendQuantities[item.name]) || 0;
                const stockEntry = stockMap[item.name.toLowerCase()];
                const avail      = stockEntry ? parseFloat(stockEntry.remaining || 0) : null;
                const stockOk    = avail !== null && avail >= needed;
                return (
                  <div key={item.name} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 8, transition: "all 0.15s",
                    background: isChecked ? "#FFFDF5" : "#FAFAFA",
                    border: `1px solid ${isChecked ? "#FCD34D" : "#E2E8F0"}`,
                  }}>
                    <input type="checkbox" checked={isChecked} onChange={() => handleToggleTrendItem(item.name)} style={{ cursor: "pointer", flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>{item.name}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, background: cs.bg, color: cs.color, padding: "1px 5px", borderRadius: 4, letterSpacing: "0.04em" }}>
                          {cs.label}
                        </span>
                        <span title={trendArrow.tip} style={{ fontSize: 13, color: trendArrow.color, fontWeight: 700, cursor: "help" }}>
                          {trendArrow.arrow}
                        </span>
                        {avail !== null && (
                          <span style={{ fontSize: 10, fontWeight: 600, color: stockOk ? "#10B981" : avail > 0 ? "#F59E0B" : "#EF4444" }}>
                            {stockOk ? `✓ ${avail}${item.unit}` : avail > 0 ? `⚠ ${avail}${item.unit}` : "✗ no stock"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>
                        {Math.round((item.frequency_pct || 0) * 100)}% of {weeks} {weekdayName || "weekday"}s · avg {item.avg_qty} {item.unit}
                        {item.last_ordered_date && ` · last: ${new Date(item.last_ordered_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      <input
                        type="number" value={trendQuantities[item.name] || ""} disabled={!isChecked}
                        onChange={(e) => handleTrendQtyChange(item.name, e.target.value)}
                        style={{ width: 64, padding: "4px 8px", fontSize: 12, fontWeight: 700, textAlign: "right", border: "1px solid #CBD5E1", borderRadius: 4, background: isChecked ? "white" : "#F1F5F9" }}
                      />
                      <span style={{ fontSize: 11, color: "#64748B", width: 22 }}>{item.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ═══ BOTTOM: Compile Bar ═════════════════════════════════════════════ */}
      <div style={{ gridColumn: "span 2", marginTop: 8 }}>
        <Card style={{ background: "#1E293B", border: "none", borderRadius: 12, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 800, color: "#e8a838", margin: "0 0 4px" }}>Consolidated Indent</h4>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <p style={{ fontSize: 12, color: "#94A3B8", margin: 0 }}>
                {livePreview.length} items · {plannedRecipes.length} dish{plannedRecipes.length !== 1 ? "es" : ""} + {selectedTrendCount} trend
                {hasDraft && draftAgo && (
                  <span style={{ marginLeft: 8, color: "#475569" }}>· draft {draftAgo}</span>
                )}
              </p>
              {stockWarnings.out > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#EF4444", background: "#1E293B", border: "1px solid #EF444440", padding: "1px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={10} /> {stockWarnings.out} out of stock
                </span>
              )}
              {stockWarnings.low > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", background: "#1E293B", border: "1px solid #F59E0B40", padding: "1px 8px", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={10} /> {stockWarnings.low} low stock
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {msg && <span style={{ color: "#34D399", fontSize: 13, fontWeight: 600 }}>{msg}</span>}
            <button onClick={handleReset}
              style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #334155", background: "transparent", fontSize: 12, fontWeight: 600, color: "#94A3B8", cursor: "pointer" }}>
              ↺ Reset
            </button>
            <button onClick={handleOpenPreview} disabled={livePreview.length === 0}
              className="compile-btn"
              style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#e8a838", fontSize: 13, fontWeight: 800, color: "#1E293B", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, opacity: livePreview.length === 0 ? 0.5 : 1, boxShadow: "0 3px 10px rgba(232,168,56,0.4)", transition: "all 0.15s" }}>
              <RefreshCw size={14} /> Preview & Compile
            </button>
          </div>
        </Card>
      </div>

      {/* ═══ Preview Modal ════════════════════════════════════════════════════ */}
      {showPreview && (
        <CompilePreviewModal
          items={livePreview.map((it) => {
            const match = stockMap[it.name.toLowerCase()];
            return { name: it.name, qty: it.qty.toString(), unit: match?.unit || it.unit || "kg", item_code: match?.item_code || "KPL-NEW", source: it.source };
          })}
          dept={dept}
          date={date}
          stocks={stocks}
          onLoadToManual={(compiledItems) => { onCompile(compiledItems); }}
          onSubmitSuccess={() => { onSubmitSuccess?.(); clearDraft(dept); handleReset(); }}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* ═══ Create Custom Dish Modal ═════════════════════════════════════════ */}
      {showCreateDish && (
        <CreateDishModal
          onClose={() => setShowCreateDish(false)}
          onSuccess={(newRecipe) => {
            setShowCreateDish(false);
            setRecipesList((prev) => [...prev, newRecipe]);
            handleAddRecipe(newRecipe);
          }}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .smart-indent-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; width: 100%; }
        .smart-column { display: flex; flex-direction: column; }
        .compile-btn:hover { opacity: 0.88 !important; }
        .compile-btn:disabled { cursor: not-allowed; }
        @media (max-width: 767px) {
          .smart-indent-layout { grid-template-columns: 1fr; }
          .smart-indent-layout > div[style*="span 2"] { grid-column: span 1; }
        }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}} />
    </div>
  );
}
