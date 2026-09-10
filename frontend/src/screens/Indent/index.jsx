import { useState, useEffect, useRef, useCallback } from "react";
import Section from "../../components/Section";
import SmartIndentTab from "./components/SmartIndentTab";
import Card from "../../components/Card";
import Btn from "../../components/Btn";
import Input from "../../components/Input";
import Select from "../../components/Select";
import Pagination from "../../components/Pagination";
import SearchBar from "../../components/SearchBar";
import ErrorMsg from "../../components/ErrorMsg";
import { COLORS, UNITS } from "../../styles/colors";
import { usePaginatedApi } from "../../hooks/useApi";
import * as api from "../../api";
import { useAppContext } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import { useLocalSpeech } from "../../hooks/useLocalSpeech";
import { getConversionMultiplier } from "../../utils/units";
import { Plus, Zap, Mic, History, Trash2, Printer, Search, Inbox, ChevronDown, ChevronUp, Camera, ClipboardList, FileSpreadsheet, Send, Sparkles, RotateCcw, TrendingUp, AlertTriangle, CheckCircle2, Minus } from "lucide-react";
import EnhancedItemAdditionModal from "./EnhancedItemAdditionModal";

// Guaranteed-unique row id. Date.now()+Math.random() collides because the large
// millisecond value truncates Math.random()'s fraction to ~2 decimals.
let _uidCounter = 0;
const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `row-${Date.now()}-${_uidCounter++}`;

const WhatsAppIcon = ({ size = 15 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={{ display: "inline-block", verticalAlign: "middle" }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const cleanDeptName = (name) => {
  if (!name) return "";
  return name.replace(/\s*\(.*?\)\s*/g, "").split(" - ")[0].split(" | ")[0].trim();
};

const formatDate = (dateStr) => {
  try {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const getStatusStyleAndText = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "issued") {
    return { bg: "#D1FAE5", color: "#065F46", text: "Issued" };
  }
  if (s === "pending") {
    return { bg: "#FEF3C7", color: "#92400E", text: "Pending" };
  }
  return { bg: "#F3F4F6", color: "#6B7280", text: status.charAt(0).toUpperCase() + status.slice(1) };
};

export const DEPARTMENT_METADATA = {
  "TIFFINS": { code: "TFN", icon: "🥞", count: 158, color: "#E8A838", bg: "#FEF3C7", desc: "Breakfast, Idli, Dosa & Batter" },
  "STAFF": { code: "STF", icon: "👥", count: 71, color: "#3B82F6", bg: "#EFF6FF", desc: "Staff Meals & Rations" },
  "SI-MEALS": { code: "SIM", icon: "🍛", count: 92, color: "#10B981", bg: "#ECFDF5", desc: "South Indian Meals & Sambar" },
  "NORTH INDIAN": { code: "NIN", icon: "🥘", count: 116, color: "#EF4444", bg: "#FEF2F2", desc: "North Indian Gravies & Paneer" },
  "CHAT & SOFTY": { code: "CHT", icon: "🍦", count: 113, color: "#EC4899", bg: "#FDF2F8", desc: "Chaat, Softies & JP Disposables" },
  "CHINESE & DOSA": { code: "CND", icon: "🍜", count: 85, color: "#F97316", bg: "#FFF7ED", desc: "Noodles, Fried Rice & Dosas" },
  "MOCKTAILS & CONTINENTAL": { code: "MCT", icon: "🍹", count: 93, color: "#8B5CF6", bg: "#F5F3FF", desc: "Mocktails & Continental Pizzas" },
  "RESTAURANT": { code: "RST", icon: "🍽️", count: 75, color: "#06B6D4", bg: "#ECFEFF", desc: "Restaurant Dining & Dairy" },
  "ROOM SERVICE": { code: "RMS", icon: "🛎️", count: 60, color: "#A855F7", bg: "#FAF5FF", desc: "In-Room Dining Orders" }
};

import { today } from "../../utils/dates";
const LIMIT = 20;

// ── ITEM NAME COMBOBOX ────────────────────────────────────────────────────────
// deptItems = ALL stock names (for search)
// deptJsonItems = dept-specific names (shown at top of results, highlighted)
function ItemNameCombobox({ value, dept, deptItems, deptJsonItems = [], stocks = [], autoFocus, onChange, onSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Keep query in sync when parent value changes (e.g. chip add, autofill)
  useEffect(() => { setQuery(value || ""); }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Build filtered list: all matching query, prioritizing dept items if applicable
  const filtered = (() => {
    if (!dept) return [];
    const q = String(query).trim().toLowerCase();
    const deptSet = new Set((deptJsonItems || []).map(n => (typeof n === "string" ? n : n?.name || "").toLowerCase()));
    const matching = (deptItems || []).filter(name => !q || String(name).toLowerCase().includes(q));
    // Dept items to top
    const deptMatches = matching.filter(n => deptSet.has(String(n).toLowerCase()));
    const otherMatches = matching.filter(n => !deptSet.has(String(n).toLowerCase()));
    return [...deptMatches, ...otherMatches].slice(0, 60);
  })();

  const handleKey = (e) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setOpen(true); setHighlighted(0); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlighted]) { onSelect(filtered[highlighted]); setQuery(filtered[highlighted]); setOpen(false); }
    }
    else if (e.key === "Escape") { setOpen(false); }
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    onChange(v);
    setOpen(true);
    setHighlighted(0);
  };

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 120);
  };

  const handleSelect = (name) => {
    onSelect(name);
    setQuery(name);
    setOpen(false);
  };

  const deptSet = new Set((deptJsonItems || []).map(n => (typeof n === "string" ? n : n?.name || "").toLowerCase()));

  return (
    <div className="item-combobox-wrap" ref={wrapRef}>
      <input
        ref={inputRef}
        className="item-combobox-input"
        value={query}
        autoFocus={autoFocus}
        placeholder="Search item..."
        onChange={handleChange}
        onFocus={() => { setOpen(true); setHighlighted(0); }}
        onBlur={handleBlur}
        onKeyDown={handleKey}
      />
      {open && (
        <div className="item-combobox-dropdown">
          {!dept ? (
            <div className="item-combobox-empty">Please select a department first</div>
          ) : filtered.length === 0 ? (
            <div className="item-combobox-empty">No items found</div>
          ) : (
            filtered.map((name, i) => {
              const stockMatch = stocks.find(s => String(s.name).toLowerCase() === String(name).toLowerCase());
              const isDeptItem = deptSet.has(String(name).toLowerCase());
              return (
                <div
                  key={name}
                  className={`item-combobox-option${highlighted === i ? " active" : ""}`}
                  onMouseDown={() => handleSelect(name)}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  <span style={{ fontWeight: 500, color: "#111827", flex: 1 }}>{name}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    {isDeptItem && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#15803D", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 4, padding: "1px 5px", letterSpacing: "0.04em" }}>DEPT</span>
                    )}
                    {stockMatch && (
                      <span style={{ fontSize: 11, color: "#6B7280", fontFamily: "monospace" }}>{stockMatch.item_code}</span>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// A name/item_code can span multiple stock batches (opening-stock import,
// re-stock at a new price, etc). `.find()` grabs whichever batch happens
// first — often a stale ₹0 opening-stock row — so cost silently stays 0
// even after picking the right item. Prefer an active (remaining>0) batch
// with a real price; fall back to any batch with a real price.
function getItemRate(stocks, item, availableStock = {}) {
  // 1. Direct price from template item
  if (item.price && parseFloat(item.price) > 0) return parseFloat(item.price);

  // 2. Direct price from availableStock map
  const cleanName = (item.name || "").toLowerCase().trim();
  if (availableStock && availableStock[cleanName]?.price && parseFloat(availableStock[cleanName].price) > 0) {
    return parseFloat(availableStock[cleanName].price);
  }

  // 3. Fallback to stocks catalog
  const matches = (stocks || []).filter(s => s.item_code === item.item_code || s.name.toLowerCase().trim() === cleanName);
  if (!matches.length) return parseFloat(item.scannedPrice) || 0;
  const withPrice = matches.filter(s => parseFloat(s.price) > 0);
  const pool = withPrice.length ? withPrice : matches;
  const active = pool.find(s => parseFloat(s.remaining) > 0);
  const stockRow = active || pool[0];
  return parseFloat(stockRow.price) || parseFloat(item.scannedPrice) || 0;
}

// Rate is priced per the STOCK's unit (e.g. ₹/kg), but the indent line can be
// in a different unit (e.g. 500 g) — multiplying qty×rate directly gave a
// 1000x-inflated cost. Convert qty into the rate's unit before multiplying.
function getLineCost(stocks, item, availableStock = {}) {
  const cleanName = (item.name || "").toLowerCase().trim();
  const matches = (stocks || []).filter(s => s.item_code === item.item_code || s.name.toLowerCase().trim() === cleanName);
  const rate = getItemRate(stocks, item, availableStock);
  const qty = parseFloat(item.qty) || 0;
  if (!matches.length) return rate * qty;
  const stockUnit = matches[0]?.unit || item.unit;
  const mult = getConversionMultiplier(item.unit, stockUnit);
  const normQty = mult !== null ? qty * mult : qty;
  return rate * normQty;
}

export default function IndentScreen() {
  const { stockNames, stocks = [], indentPreFill, setIndentPreFill, indentSmartPreFill, setIndentSmartPreFill, setCurrentScreen, currentScreen } = useAppContext();
  const { roles, hasPermission } = useAuth();
  const isChef         = roles.some((r) => r.key === "chef");
  const isStoreManager = roles.some((r) => r.key === "store_manager" || r.key === "admin" || r.key === "director" || r.key === "store_keeper") || currentScreen === "store_manager_indent" || currentScreen?.startsWith("store_manager");
  const [deptsList, setDeptsList] = useState([]);
  const [deptItemsMap, setDeptItemsMap] = useState({});
  const [deptLeftovers, setDeptLeftovers] = useState([]);
  const [availableStock, setAvailableStock] = useState({});
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [templateLoadedDept, setTemplateLoadedDept] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [templateStats, setTemplateStats] = useState({ total: 0, dept: "" });
  const [filterMode, setFilterMode] = useState("all"); // 'all' | 'ordered' | 'low_stock'
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  const stepQty = (idx, delta) => {
    setForm(prev => {
      const current = parseFloat(prev.items[idx]?.qty) || 0;
      const nextVal = Math.max(0, parseFloat((current + delta).toFixed(2)));
      const newItems = [...prev.items];
      newItems[idx] = {
        ...newItems[idx],
        qty: nextVal === 0 ? "" : String(nextVal)
      };
      return { ...prev, items: newItems };
    });
  };

  const addPresetQty = (idx, addAmount) => {
    setForm(prev => {
      const current = parseFloat(prev.items[idx]?.qty) || 0;
      const nextVal = parseFloat((current + addAmount).toFixed(2));
      const newItems = [...prev.items];
      newItems[idx] = {
        ...newItems[idx],
        qty: String(nextVal)
      };
      return { ...prev, items: newItems };
    });
  };

  const handleAutoFillRecommendations = async () => {
    if (!form.dept) {
      setMsg("Please select a department first");
      return;
    }
    setLoadingRecommendations(true);
    try {
      const res = await api.indents.recommendations({ dept: form.dept, date: form.date, weeks: 4 });
      if (res.success && res.data && res.data.length > 0) {
        const recMap = new Map();
        res.data.forEach(r => {
          recMap.set(r.name.toLowerCase().trim(), r);
          if (r.item_code) recMap.set(r.item_code.toUpperCase().trim(), r);
        });

        let filledCount = 0;
        setForm(prev => {
          const updatedItems = prev.items.map(item => {
            const cleanName = (item.name || "").toLowerCase().trim();
            const codeKey = (item.item_code || "").toUpperCase().trim();
            const rec = recMap.get(cleanName) || recMap.get(codeKey);

            if (rec && rec.avg_qty > 0) {
              filledCount++;
              return {
                ...item,
                qty: String(rec.avg_qty),
                notes: rec.trend_direction === "up" ? "⚡ Auto-Par (Rising Trend)" : (item.notes || "⚡ Auto-Par")
              };
            }
            return item;
          });

          return { ...prev, items: updatedItems };
        });

        setMsg(`⚡ Multi-Agent Auto-Par: Filled ${filledCount} items based on weekday moving averages! ✓`);
        setTimeout(() => setMsg(""), 4000);
      } else {
        setMsg("No historical weekday consumption patterns recorded for this department yet.");
        setTimeout(() => setMsg(""), 3500);
      }
    } catch (err) {
      console.error("Failed to load multi-agent recommendations:", err);
      setMsg("Multi-Agent Recommendation error: " + (err.message || "Unknown"));
      setTimeout(() => setMsg(""), 3500);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const handleResetQuantities = () => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map(it => ({ ...it, qty: "" }))
    }));
    setMsg("All quantities reset to zero. ✓");
    setTimeout(() => setMsg(""), 2500);
  };

  // Local speech-to-text (Whisper Tiny — no Google, no internet)
  const { listening, statusMsg: speechStatus, startRecording, stopRecording } = useLocalSpeech();
  
  const [form, setForm] = useState({ dept: "", date: today(), indent_type: "routine", items: [{ id: uid(), name: "", qty: "", unit: "kg", item_code: "", notes: "" }] });
  const [activeRowIdx, setActiveRowIdx] = useState(0);
  const [activeTab, setActiveTab] = useState(isStoreManager ? "history" : "manual");
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const [expandedIndentIds, setExpandedIndentIds] = useState(new Set());
  const [msg, setMsg]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loadingScan, setLoadingScan] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);   // 0-100 buffering %
  const [scanStage, setScanStage] = useState("");        // human stage label
  const scanTimerRef = useRef(null);
  const toggleIndentAccordion = (id) => {
    setExpandedIndentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fileInputRef = useRef(null);

  // Gemini gives no real progress stream, so ease a smooth bar toward ~92% while
  // the request is in flight, then snap to 100% on completion.
  const startScanProgress = () => {
    clearInterval(scanTimerRef.current);
    let p = 6;
    setScanProgress(p);
    setScanStage("Uploading slip…");
    scanTimerRef.current = setInterval(() => {
      const step = Math.max(0.6, (92 - p) * 0.08); // ease-out toward 92
      p = Math.min(92, p + step);
      setScanProgress(Math.round(p));
      if (p >= 60) setScanStage("Matching items to stock…");
      else if (p >= 28) setScanStage("Reading text…");
    }, 220);
  };
  const finishScanProgress = (ok = true) => {
    clearInterval(scanTimerRef.current);
    setScanProgress(100);
    setScanStage(ok ? "Done ✓" : "Failed");
    setTimeout(() => { setScanProgress(0); setScanStage(""); }, 700);
  };
  const { items, total, page, loading, error, fetch } = usePaginatedApi(api.indents.list);

  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState({});
  const [activeCategory, setActiveCategory] = useState("All");
  const [historySearch, setHistorySearch] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleExportAutomatedExcel = async () => {
    try {
      setIsExportingExcel(true);
      await api.indents.downloadAutomatedExcel();
      setMsg("Automated Indent Forecasting Engine Excel downloaded successfully! ✓");
      setTimeout(() => setMsg(""), 4000);
    } catch (err) {
      console.error("Failed to export automated indent excel:", err);
      setMsg("Export failed: " + (err.message || "Unknown error"));
      setTimeout(() => setMsg(""), 4000);
    } finally {
      setIsExportingExcel(false);
    }
  };
  const uniqueStockItems = [];
  const seenNames = new Set();
  (stocks || []).forEach(s => {
    if (s && s.name) {
      const nameLower = s.name.toLowerCase();
      if (!seenNames.has(nameLower)) {
        seenNames.add(nameLower);
        uniqueStockItems.push(s);
      }
    }
  });

  // Category classifier helper
  const getItemCategory = (name) => {
    const n = name.toLowerCase();
    if (n.includes("rice") || n.includes("oil") || n.includes("basmati") || n.includes("powder") || n.includes("dal") || n.includes("atta") || n.includes("sugar") || n.includes("masala") || n.includes("soda") || n.includes("salt") || n.includes("flour")) return "Grocery";
    if (n.includes("butter") || n.includes("curd") || n.includes("milk") || n.includes("cheese") || n.includes("paneer")) return "Dairy";
    if (n.includes("ginger") || n.includes("garlic") || n.includes("chilli") || n.includes("lemon") || n.includes("onion") || n.includes("potato") || n.includes("mint") || n.includes("coriander")) return "Vegetables";
    if (n.includes("cover") || n.includes("dust") || n.includes("napkin") || n.includes("soap") || n.includes("mop") || n.includes("paper") || n.includes("bottle") || n.includes("cup") || n.includes("glass") || n.includes("spoon")) return "Disposables";
    return "Others";
  };

  // ALL unique stock items — used by combobox search and multi-select modal
  const allStockNames = uniqueStockItems.map(s => s.name);

  // Normalise a dept item entry — supports legacy plain string and new { name, unit } format
  const getDeptItemName = (entry) => (typeof entry === "string" ? entry : entry.name);
  const getDeptItemUnit = (entry) => (typeof entry === "string" ? null : entry.unit);

  // Strict mapping: only items mapped to the selected department in department_items.json
  const getFilteredStockItems = () => {
    if (!form.dept) return [];
    const deptItemsArr = deptItemsMap[form.dept] || deptItemsMap[form.dept.toUpperCase()] || [];
    const allowed = new Set(deptItemsArr.map(e => getDeptItemName(e).toLowerCase()));
    return uniqueStockItems.filter(s => allowed.has(s.name.toLowerCase()));
  };

  const filteredStockItems = getFilteredStockItems();
  const filteredStockNames = filteredStockItems.map(s => s.name);

  // Get department items — used for Quick Add suggestion chips
  const deptJsonItems = form.dept
    ? (deptItemsMap[form.dept] || deptItemsMap[form.dept.toUpperCase()] || [])
    : [];

  // Quick-add suggestion chips: first 8 items for the selected dept
  const suggestedChips = deptJsonItems.slice(0, 8);

  const load = (overrides = {}) =>
    fetch({ limit: LIMIT, sort: "created_at", order: "desc", status: statusFilter, ...overrides });

  const loadLeftovers = (deptName) => {
    if (!deptName) return;
    api.leftovers.list({ dept: deptName, limit: 50 }).then((res) => {
      if (res.success) {
        setDeptLeftovers((res.data || []).filter(l => l.qty > 0 && l.carried_forward));
      }
    }).catch(console.error);
  };

  // Fetch available stock for selected items inline
  const fetchStockLevels = async (itemNames) => {
    const cleanNames = itemNames.filter(Boolean);
    if (cleanNames.length === 0) return;
    try {
      const res = await api.stock.available(cleanNames);
      if (res.success) {
        setAvailableStock(prev => ({ ...prev, ...res.data }));
      }
    } catch {}
  };

  // Load and Restore from localStorage
  useEffect(() => () => clearInterval(scanTimerRef.current), []); // clear scan timer on unmount

  useEffect(() => {
    load();

    const savedDraft = localStorage.getItem("kapila_indent_draft");
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setForm(parsed);
        const itemNames = parsed.items.map(it => it.name).filter(Boolean);
        fetchStockLevels(itemNames);
      } catch {}
    }

    api.departments.list().then((res) => {
      if (res.success && res.data.length > 0) {
        setDeptsList(res.data);
        
        if (indentPreFill) {
          if (indentPreFill.dept && !indentPreFill.items) {
            setActiveTab(indentPreFill.tab || "manual");
            setForm((f) => ({ ...f, dept: indentPreFill.dept }));
            loadLeftovers(indentPreFill.dept);
            loadDepartmentTemplate(indentPreFill.dept);
            setIndentPreFill(null);
            setMsg(`Loaded ${indentPreFill.dept} template ✓`);
            setTimeout(() => setMsg(""), 3000);
          } else if (indentPreFill.tab) {
            setActiveTab(indentPreFill.tab);
            if (indentPreFill.statusFilter) {
              setStatusFilter(indentPreFill.statusFilter);
              load({ page: 1, status: indentPreFill.statusFilter });
            }
            setIndentPreFill(null);
          } else if (indentPreFill.items) {
            const newForm = {
              dept: indentPreFill.dept,
              date: today(),
              items: indentPreFill.items.map(it => ({
                name: it.name,
                qty: it.qty.toString(),
                unit: it.unit,
                item_code: stocks.find(s => s.name.toLowerCase() === it.name.toLowerCase())?.item_code || "KPL-NEW"
              }))
            };
            setForm(newForm);
            loadLeftovers(indentPreFill.dept);
            fetchStockLevels(indentPreFill.items.map(it => it.name));
            setIndentPreFill(null);
            setMsg("Pre-filled items from Menu Plan ✓");
            setTimeout(() => setMsg(""), 3000);
          }
        } else {
          const validNames = res.data.map(d => d.name);
          setForm((f) => {
            if (!f.dept || !validNames.includes(f.dept)) {
              loadLeftovers(res.data[0].name);
              return { ...f, dept: res.data[0].name };
            }
            loadLeftovers(f.dept);
            return f;
          });
        }
      }
    }).catch(console.error);

    api.departments.items().then((res) => {
      if (res.success && res.data) {
        setDeptItemsMap(res.data);
      }
    }).catch(console.error);
  }, [indentPreFill]);

  // Save changes to draft
  useEffect(() => {
    if (form.dept) {
      localStorage.setItem("kapila_indent_draft", JSON.stringify(form));
    }
  }, [form]);

  // When Production Planner sends a smart pre-fill, switch to Smart tab.
  // SmartIndentTab reads from localStorage (draft key) which ProductionPlanner already wrote.
  useEffect(() => {
    if (!indentSmartPreFill) return;
    setForm((f) => ({
      ...f,
      dept: indentSmartPreFill.dept,
      date: indentSmartPreFill.date || f.date,
    }));
    setActiveTab("smart");
    setIndentSmartPreFill(null);
    setMsg("Production plans loaded into Smart Indent ✓");
    setTimeout(() => setMsg(""), 3500);
  }, [indentSmartPreFill]);

  const loadDepartmentTemplate = async (deptName) => {
    if (!deptName) return;
    setLoadingTemplate(true);
    try {
      const res = await api.indents.templateDetails(deptName);
      if (res.success && res.data && res.data.items && res.data.items.length > 0) {
        const tItems = res.data.items.map((it) => ({
          id: uid(),
          name: it.item_name,
          item_code: it.item_code || "KPL-NEW",
          qty: "",
          unit: it.default_unit || "kg",
          notes: "",
          row_no: it.row_no,
          current_stock: it.current_stock,
          price: it.price,
          is_low_stock: it.is_low_stock
        }));

        const stockMapUpdate = {};
        res.data.items.forEach(it => {
          stockMapUpdate[it.item_name.toLowerCase().trim()] = {
            available: it.current_stock,
            unit: it.stock_unit || it.default_unit,
            price: it.price
          };
        });
        setAvailableStock(prev => ({ ...prev, ...stockMapUpdate }));

        setForm(f => ({
          ...f,
          dept: deptName,
          items: tItems
        }));
        setTemplateLoadedDept(deptName);
        setTemplateStats({ total: tItems.length, dept: res.data.displayName || deptName });
        setMsg(`Loaded ${res.data.displayName || deptName} template (${tItems.length} items) ✓`);
        setTimeout(() => setMsg(""), 3500);
      } else {
        setMsg(`No pre-printed template found for ${deptName}.`);
        setTimeout(() => setMsg(""), 3000);
      }
    } catch (err) {
      console.error("Failed to load department template:", err);
      setMsg(`Template not available: ${err.message}`);
      setTimeout(() => setMsg(""), 3000);
    } finally {
      setLoadingTemplate(false);
    }
  };

  // Auto-load template when department is selected or initialized if items are empty
  useEffect(() => {
    if (form.dept && (!form.items || form.items.length <= 1 || (form.items.length === 1 && !form.items[0].name)) && templateLoadedDept !== form.dept) {
      loadDepartmentTemplate(form.dept);
    }
  }, [form.dept, templateLoadedDept]);

  const selectDepartment = (deptName) => {
    if (!deptName) return;
    setForm((f) => ({ ...f, dept: deptName }));
    loadLeftovers(deptName);
    loadDepartmentTemplate(deptName);
    setMsg(`Switched to ${deptName} template ✓`);
    setTimeout(() => setMsg(""), 2500);
  };

  const handleDeptChange = (e) => {
    selectDepartment(e.target.value);
  };

  const addRow = () => {
    setForm((f) => ({ ...f, items: [...f.items, { id: uid(), name: "", qty: "", unit: "kg", item_code: "", notes: "" }] }));
    setActiveRowIdx(form.items.length); // Focus on the new row
  };

  // High-standard multi-agent item addition handler
  const handleAddEnhancedItems = (itemsToAdd) => {
    if (!itemsToAdd || itemsToAdd.length === 0) return;

    setForm(prev => {
      // Clean out lone empty starter row if it exists
      const baseItems = (prev.items.length === 1 && !prev.items[0].name) ? [] : [...prev.items];
      
      const newItems = [...baseItems];
      let addedCount = 0;
      let updatedCount = 0;

      itemsToAdd.forEach(toAdd => {
        const cleanName = (toAdd.name || "").toLowerCase().trim();
        const codeKey = (toAdd.item_code || "").toUpperCase().trim();
        
        // Check if row already exists in table
        const existingIdx = newItems.findIndex(row => {
          const rowName = (row.name || "").toLowerCase().trim();
          const rowCode = (row.item_code || "").toUpperCase().trim();
          return (codeKey && rowCode === codeKey) || (cleanName && rowName === cleanName);
        });

        if (existingIdx >= 0) {
          // Increment or update existing row
          const existingRow = newItems[existingIdx];
          const prevQty = parseFloat(existingRow.qty) || 0;
          const addedQty = parseFloat(toAdd.qty) || 0;
          const newQty = prevQty + addedQty;

          newItems[existingIdx] = {
            ...existingRow,
            qty: String(newQty),
            notes: toAdd.notes || existingRow.notes || "",
            is_custom: toAdd.is_custom || existingRow.is_custom,
            urgency: toAdd.urgency || existingRow.urgency
          };
          updatedCount++;
        } else {
          // Append new item
          newItems.push({
            id: uid(),
            name: toAdd.name,
            qty: String(toAdd.qty || ""),
            unit: toAdd.unit || "kg",
            item_code: toAdd.item_code || "",
            price: toAdd.price || 0,
            notes: toAdd.notes || "",
            is_custom: !!toAdd.is_custom,
            urgency: toAdd.urgency || "routine"
          });
          addedCount++;
        }
      });

      return { ...prev, items: newItems };
    });

    // Fetch stock levels for all added items
    const names = itemsToAdd.map(i => i.name).filter(Boolean);
    if (names.length > 0) fetchStockLevels(names);

    const totalCount = itemsToAdd.length;
    setMsg(`Added ${totalCount} item${totalCount > 1 ? "s" : ""} to Indent ✓`);
    setTimeout(() => setMsg(""), 3500);
  };

  const handleAddTemplateItem = async (payload) => {
    try {
      const res = await api.departments.addTemplateItem(payload);
      if (res.success) {
        setMsg(`Item '${payload.item_name}' permanently added to ${payload.department} template! ✓`);
        loadDepartmentTemplate(payload.department);
      }
    } catch (err) {
      console.error("Failed to add template item:", err);
      throw err;
    }
  };
  const removeRow = (idx) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const clearAll = () => {
    setForm((f) => ({ ...f, items: [] }));
    setActiveRowIdx(0);
  };

  // Add a suggestion chip — accepts { name, unit } object or plain string
  const addSuggestionChip = (entry) => {
    const itemName = getDeptItemName(entry);
    const hintUnit = getDeptItemUnit(entry);
    setForm(prev => {
      const exists = prev.items.some(it => it.name.toLowerCase() === itemName.toLowerCase());
      if (exists) return prev;
      const stockMatch = stocks.find(s => s.name.toLowerCase() === itemName.toLowerCase());
      const baseItems = (prev.items.length === 1 && !prev.items[0].name) ? [] : prev.items;
      const newRow = {
        id: uid(),
        name: itemName,
        qty: "",
        unit: stockMatch?.unit || hintUnit || "kg",
        item_code: stockMatch?.item_code || "",
        notes: ""
      };
      fetchStockLevels([itemName]);
      return { ...prev, items: [...baseItems, newRow] };
    });
  };

  // Select an item from the combobox dropdown
  const selectComboItem = (idx, itemName) => {
    const stockMatch = stocks.find(s => s.name.toLowerCase() === itemName.toLowerCase());
    const scannedRow = form.items[idx];

    // Row came from a scan and wasn't a confident match (fuzzy/none) — the store
    // manager just corrected it, so teach the mapping. Next scan of this exact
    // OCR spelling auto-matches, no correction needed again.
    if (stockMatch && scannedRow?.scannedName && scannedRow.matchVia !== "alias" && scannedRow.matchVia !== "exact"
        && scannedRow.scannedName.toLowerCase() !== itemName.toLowerCase()) {
      api.stock.createAlias(scannedRow.scannedName, stockMatch.item_code).catch(() => {});
    }

    setForm(f => {
      const newItems = f.items.map((it, i) => {
        if (i !== idx) return it;
        return {
          ...it,
          name: itemName,
          unit: stockMatch?.unit || it.unit || "kg",
          item_code: stockMatch?.item_code || it.item_code || "",
          matchVia: stockMatch ? "corrected" : it.matchVia,
          suggestedName: null,
        };
      });
      return { ...f, items: newItems };
    });
    if (stockMatch) fetchStockLevels([itemName]);
  };

  const addSelectedItems = () => {
    const toAdd = filteredStockItems.filter(s => selectedItems[s.name]);
    if (toAdd.length > 0) {
      setForm(prev => {
        const baseItems = (prev.items.length === 1 && !prev.items[0].name) ? [] : prev.items;
        const newRows = toAdd.map(s => ({
          id: uid(),
          name: s.name,
          qty: "",
          unit: s.unit,
          item_code: s.item_code,
          notes: "",
        }));
        return { ...prev, items: [...baseItems, ...newRows] };
      });
      fetchStockLevels(toAdd.map(s => s.name));
      setSelectedItems({});
      setShowModal(false);
      setSearchQuery("");
    }
  };
  
  const updateItem = (idx, field, val) => {
    setForm((f) => {
      const newItems = f.items.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: val };
        if (field === "name") {
          const matched = stocks.find((s) => s.name.toLowerCase() === val.trim().toLowerCase());
          if (matched) {
            updated.unit = matched.unit;
            updated.item_code = matched.item_code;
            fetchStockLevels([matched.name]);
          }
        }
        if (field === "unit") {
          const oldUnit = it.unit;
          const newUnit = val;
          const currentQty = parseFloat(it.qty);
          if (!isNaN(currentQty) && oldUnit && newUnit) {
            const mult = getConversionMultiplier(oldUnit, newUnit, it.name);
            if (mult !== null) {
              const newQty = currentQty * mult;
              updated.qty = (Math.round(newQty * 1000) / 1000).toString();
            }
          }
        }
        return updated;
      });
      return { ...f, items: newItems };
    });
  };

  const deductLeftover = (leftover) => {
    setForm(prev => {
      const matchedIdx = prev.items.findIndex(it => it.name.toLowerCase() === leftover.item.toLowerCase());
      if (matchedIdx !== -1) {
        const newItems = [...prev.items];
        const currentQty = parseFloat(newItems[matchedIdx].qty || 0);
        const newQty = Math.max(0, currentQty - leftover.qty);
        newItems[matchedIdx] = { ...newItems[matchedIdx], qty: newQty.toString() };
        return { ...prev, items: newItems };
      } else {
        const stockItem = stocks.find(s => s.name.toLowerCase() === leftover.item.toLowerCase());
        const baseItems = (prev.items.length === 1 && !prev.items[0].name) ? [] : prev.items;
        fetchStockLevels([leftover.item]);
        return {
          ...prev,
          items: [
            ...baseItems,
            {
              name: leftover.item,
              qty: "0",
              unit: leftover.unit,
              item_code: stockItem ? stockItem.item_code : "KPL-NEW"
            }
          ]
        };
      }
    });
    setDeptLeftovers(prev => prev.filter(l => l.id !== leftover.id));
  };

  const smartAutofill = async () => {
    if (!form.dept) {
      setMsg("Please select a department first");
      setTimeout(() => setMsg(""), 2000);
      return;
    }
    setMsg("Fetching smart template...");
    try {
      const res = await api.indents.recommendations({ dept: form.dept, date: form.date, weeks: 4 });
      if (res.success && res.data && res.data.length > 0) {
        const templateItems = res.data
          .filter(r => r.avg_qty > 0)
          .map(r => ({
            id: uid(),
            name: r.name,
            qty: r.avg_qty.toString(),
            unit: r.unit || "kg",
            item_code: r.item_code || "KPL-NEW",
            notes: ""
          }));

        if (templateItems.length > 0) {
          setForm(f => ({ ...f, items: templateItems }));
          fetchStockLevels(templateItems.map(it => it.name));
          setMsg(`Smart template autofilled with ${templateItems.length} items ✓`);
          setTimeout(() => setMsg(""), 3000);
        } else {
          setMsg("No typical items found for this department on this weekday.");
          setTimeout(() => setMsg(""), 3000);
        }
      } else {
        setMsg("No history found to generate a template.");
        setTimeout(() => setMsg(""), 3000);
      }
    } catch (err) {
      setMsg("Autofill failed: " + err.message);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleScanClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoadingScan(true);
    setMsg("");
    startScanProgress();

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = reader.result.split(",")[1];
        const res = await api.scan.indent(base64String, file.type || "image/jpeg");
        if (res.success && res.data) {
          const parsed = res.data;
          
          let updatedDept = form.dept;
          if (parsed.dept) {
            const matchedDept = deptsList.find(d => d.name.toLowerCase() === parsed.dept.toLowerCase());
            if (matchedDept) {
              updatedDept = matchedDept.name;
            }
          }

          const parsedItems = (parsed.items || []).map(it => ({
            id: uid(),
            name: it.name.toUpperCase(),
            qty: (it.qty != null ? it.qty : "").toString(),
            unit: it.unit || "pcs",
            item_code: it.item_code || "KPL-NEW",
            notes: "",
            qtyMissing: it.qty == null,
            scannedName: it.scanned_name || it.name,   // exact OCR text — used to teach an alias if corrected
            matchVia: it.match_via || null,             // "alias" | "exact" | "fuzzy" | null
            suggestedName: it.suggested_name || null,
            scannedPrice: it.scanned_price || null,     // OCR-read price — used when item has no stock match
            confidence: it.confidence !== undefined ? it.confidence : 1.0,
          }));

          if (parsedItems.length > 0) {
            setForm(prev => {
              const baseItems = (prev.items.length === 1 && !prev.items[0].name) ? [] : prev.items;
              return {
                ...prev,
                dept: updatedDept,
                items: [...baseItems, ...parsedItems]
              };
            });
            fetchStockLevels(parsedItems.map(it => it.name));
            const missingQty = parsedItems.filter(it => it.qtyMissing).length;
            const missingMsg = missingQty > 0 ? ` — ⚠ ${missingQty} item${missingQty > 1 ? "s" : ""} need quantity` : "";
            setMsg(`Scanned: ${parsedItems.length} items added ✓${missingMsg}`);
          } else {
            setMsg("No items could be recognized from the document.");
          }
        } else {
          setMsg("Scan failed: " + (res.error || "Unknown error"));
        }
      } catch (err) {
        setMsg("Scan failed: " + err.message);
      } finally {
        finishScanProgress(true);
        setLoadingScan(false);
        e.target.value = null;
        setTimeout(() => setMsg(""), 4000);
      }
    };
    reader.onerror = () => {
      finishScanProgress(false);
      setLoadingScan(false);
      setMsg("Error reading file.");
      setTimeout(() => setMsg(""), 4000);
    };
    reader.readAsDataURL(file);
  };

  const startListening = () => {
    if (listening) {
      stopRecording((status) => {
        setMsg(status);
        setTimeout(() => setMsg(""), 3000);
      });
    } else {
      startRecording(
        (text) => {
          parseVoiceInput(text);
          setMsg(`Heard: "${text}"`);
          setTimeout(() => setMsg(""), 3500);
        },
        (status) => {
          setMsg(status);
        }
      );
    }
  };

  const parseVoiceInput = async (text) => {
    setMsg("Fuzzy matching items with AI...");
    try {
      const res = await api.indents.voiceParse(text);
      if (res.success && res.data && res.data.length > 0) {
        setForm(prev => {
          const baseItems = (prev.items.length === 1 && !prev.items[0].name) ? [] : prev.items;
          const newItems = res.data.map((it, i) => ({
            id: uid(),
            name: it.name,
            qty: it.qty.toString(),
            unit: it.unit || "kg",
            item_code: it.item_code || "KPL-NEW",
            notes: ""
          }));
          return { ...prev, items: [...baseItems, ...newItems] };
        });
        fetchStockLevels(res.data.map(it => it.name));
        setMsg(`Heard: "${text}" ✓ (Added ${res.data.length} items)`);
        setTimeout(() => setMsg(""), 3500);
      } else {
        setMsg(`Heard: "${text}" but found no items.`);
        setTimeout(() => setMsg(""), 3500);
      }
    } catch (err) {
      setMsg("Voice parsing failed: " + err.message);
      setTimeout(() => setMsg(""), 4000);
    }
  };

  const getShareText = () => {
    const itemsText = form.items
      .filter(i => i.name && i.qty)
      .map(i => `• ${i.name}: ${i.qty} ${i.unit || "kg"}`)
      .join("\n");
    const typeLabel = form.indent_type === "adhoc" ? "Ad-Hoc (Emergency)" : "Routine (Nightly)";
    return `*KAPILA INVENTORY - INDENT REQUEST*\n` +
           `*Type:* ${typeLabel}\n` +
           `*Department:* ${form.dept}\n` +
           `*Date Needed:* ${form.date}\n\n` +
           `*Items Requested:*\n${itemsText}`;
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const printSlip = () => {
    const escapeHtml = (unsafe) => {
      return (unsafe || "").toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const itemsHtml = form.items
      .filter(i => i.name && i.qty)
      .map(i => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${escapeHtml(i.item_code || "N/A")}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${escapeHtml(i.name)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${escapeHtml(i.qty)} ${escapeHtml(i.unit || "kg")}</td>
        </tr>
      `).join("");

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Indent Slip - ${escapeHtml(form.dept)}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
            .logo-container { background: #ffffff; border-radius: 8px; padding: 8px 20px; display: inline-flex; align-items: center; justify-content: center; }
            .details { margin-bottom: 20px; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f2f2f2; padding: 8px; text-align: left; border-bottom: 2px solid #ddd; }
            .footer { text-align: center; font-size: 12px; color: #777; margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo-container">
              <img src="/kapila-logo.png" alt="Kapila" style="height: 32px; display: block;" />
            </div>
            <h3 style="margin: 6px 0 0; font-size: 16px; letter-spacing: 0.05em; color: #475569; text-transform: uppercase;">Indent Slip</h3>
            <span style="display:inline-block; margin-top:4px; padding: 3px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; background: ${form.indent_type === 'adhoc' ? '#FEF3C7' : '#DCFCE7'}; color: ${form.indent_type === 'adhoc' ? '#92400E' : '#166534'}; border: 1px solid ${form.indent_type === 'adhoc' ? '#FCD34D' : '#86EFAC'}">${form.indent_type === 'adhoc' ? '⚡ AD-HOC INDENT' : '✓ ROUTINE INDENT'}</span>
          </div>
          <div class="details">
            <p><strong>Department:</strong> ${escapeHtml(form.dept)}</p>
            <p><strong>Date Needed:</strong> ${escapeHtml(form.date)}</p>
            <p><strong>Printed At:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Item Name</th>
                <th style="text-align: right;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="footer">
            <p>Kapila Kitchen Indent Request System</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const submit = async () => {
    // qty must be a real positive number — "0" and "" are truthy strings but invalid.
    const validItems = form.items.filter((i) => i.name && parseFloat(i.qty) > 0);
    if (!validItems.length) {
      setMsg("Add a quantity (greater than 0) for at least one item before submitting.");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    try {
      await api.indents.create({ ...form, indent_type: form.indent_type || "routine", items: validItems.map((i) => ({ ...i, qty: parseFloat(i.qty), unit: i.unit || "kg", item_code: i.item_code || "KPL-NEW" })) });
      localStorage.removeItem("kapila_indent_draft");
      setForm({ dept: deptsList[0]?.name || "", date: today(), indent_type: "routine", items: [{ name: "", qty: "", unit: "kg", item_code: "" }] });
      
      if (isStoreManager) {
        setMsg("Indent submitted! Redirecting to Issuance... ✓");
        setTimeout(() => {
          setMsg("");
          setCurrentScreen("store_manager_store_issuance");
        }, 1500);
      } else if (hasPermission && hasPermission("issuances.create")) {
        setMsg("Indent submitted! Redirecting to Issuance... ✓");
        setTimeout(() => {
          setMsg("");
          setCurrentScreen("issuance");
        }, 1500);
      } else {
        setMsg("Indent submitted ✓");
        setTimeout(() => setMsg(""), 2000);
      }
      load({ page: 1 });
    } catch (e) {
      setMsg("Error: " + e.message);
    }
  };

  const handleDeleteIndent = async (indentId) => {
    const confirmed = window.confirm("Are you sure you want to delete this indent request?");
    if (!confirmed) return;
    try {
      const res = await api.indents.remove(indentId);
      if (res.success) {
        setMsg("Indent deleted ✓");
        setTimeout(() => setMsg(""), 3000);
        load({ page });
      }
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  };

  
  return (
    <Section 
      title="Indent Request" 
      sub="Departments submit nightly material requirements"
      onBack={
        isChef         ? () => setCurrentScreen("chef_home") :
        isStoreManager ? () => setCurrentScreen("store_manager_available_stock") :
        null
      }
    >
      <div className="indent-page-wrapper">
        
        {/* --- TABS --- */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E5E7EB", paddingBottom: "10px", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveTab("manual")}
              style={{
                background: activeTab === "manual" ? "#F1F5F9" : "transparent",
                border: "none",
                borderBottom: activeTab === "manual" ? "2px solid #0F172A" : "2px solid transparent",
                color: activeTab === "manual" ? "#0F172A" : "#64748B",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
                borderRadius: activeTab === "manual" ? "6px 6px 0 0" : 0
              }}
            >
              📝 Manual Indent
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("smart")}
              style={{
                background: activeTab === "smart" ? "#FFFBEB" : "transparent",
                border: "none",
                borderBottom: activeTab === "smart" ? "2px solid #D97706" : "2px solid transparent",
                color: activeTab === "smart" ? "#B45309" : "#64748B",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
                borderRadius: activeTab === "smart" ? "6px 6px 0 0" : 0
              }}
            >
              ⚡ Smart Auto-Indent & Recipes
            </button>
            {isStoreManager && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("history");
                  load({ page: 1 });
                }}
                style={{
                  background: activeTab === "history" ? "#EFF6FF" : "transparent",
                  border: "none",
                  borderBottom: activeTab === "history" ? "2px solid #2563EB" : "2px solid transparent",
                  color: activeTab === "history" ? "#1E3A8A" : "#64748B",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  borderRadius: activeTab === "history" ? "6px 6px 0 0" : 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                📋 All Indents History (Register)
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportAutomatedExcel}
            disabled={isExportingExcel}
            style={{
              background: "#FEF3C7",
              border: "1px solid #D97706",
              color: "#92400E",
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: isExportingExcel ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}
            title="Download Dynamic Indent Automation & Forecasting Engine Excel"
          >
            <FileSpreadsheet size={15} color="#D97706" />
            {isExportingExcel ? "Generating Engine…" : "📊 Download Forecasting Engine (Excel)"}
          </button>
        </div>

        {activeTab === "manual" ? (
          <div>
            {/* DEPARTMENT TOUCH TILES RIBBON (FOR LAYMAN CHEF) */}
            <div style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "14px",
              padding: "14px 16px",
              marginBottom: "16px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>👨‍🍳</span>
                  <div>
                    <h3 style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", margin: 0, letterSpacing: "0.02em" }}>
                      KITCHEN DEPARTMENTS (TOUCH A TILE TO OPEN VOUCHER TEMPLATE)
                    </h3>
                    <p style={{ fontSize: "11px", color: "#64748B", margin: "2px 0 0" }}>
                      Tap any department below to instantly load its official voucher items (60–158 items)
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>Or Select Dropdown:</label>
                  <select
                    className="indent-field"
                    style={{ width: "auto", minWidth: 170, padding: "5px 10px", fontSize: 12, height: 32, borderRadius: 8, borderColor: "#CBD5E1", background: "#F8FAFC", fontWeight: 600 }}
                    value={form.dept}
                    onChange={handleDeptChange}
                  >
                    {deptsList.map((d) => <option key={d.id} value={d.name}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
              </div>

              {/* 9 Department Touch Tiles */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                gap: "8px"
              }}>
                {deptsList.map((d) => {
                  const isSelected = form.dept === d.name;
                  const meta = DEPARTMENT_METADATA[d.name] || { icon: "🍽️", count: 60, color: "#E8A838", bg: "#FEF3C7" };
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => selectDepartment(d.name)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "10px 6px 8px",
                        borderRadius: "10px",
                        border: isSelected ? `2px solid ${meta.color}` : "1.5px solid #E2E8F0",
                        background: isSelected ? meta.bg : "#FFFFFF",
                        boxShadow: isSelected ? `0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px ${meta.color}` : "0 1px 3px rgba(0,0,0,0.03)",
                        cursor: "pointer",
                        transition: "all 0.16s ease",
                        textAlign: "center",
                        position: "relative",
                        minHeight: "68px",
                        outline: "none"
                      }}
                    >
                      <span style={{ fontSize: "20px", marginBottom: "3px" }}>{meta.icon}</span>
                      <span style={{
                        fontSize: "10px",
                        fontWeight: 800,
                        color: isSelected ? "#0F172A" : "#334155",
                        lineHeight: 1.15,
                        textTransform: "uppercase"
                      }}>
                        {d.name}
                      </span>
                      <span style={{
                        fontSize: "9px",
                        fontWeight: 700,
                        color: isSelected ? meta.color : "#64748B",
                        marginTop: "2px"
                      }}>
                        {meta.count} items
                      </span>
                      {isSelected && (
                        <span style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 14,
                          height: 14,
                          borderRadius: "50%",
                          background: "#059669",
                          color: "#FFFFFF",
                          fontSize: 9,
                          fontWeight: 900,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="indent-top-section">
            
            {/* LEFT PANEL */}
            <div className="indent-left-panel">
              <Card style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "20px 24px", display: "flex", flexDirection: "column" }}>
                <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", color: "#475569", textTransform: "uppercase", marginBottom: "20px" }}>NEW INDENT FORM</p>
                
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: "12px", color: "#475569", marginBottom: "6px", display: "block", fontWeight: 500 }}>
                    Active Department
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <select className="indent-field" value={form.dept} onChange={handleDeptChange} style={{ flex: 1 }}>
                      {deptsList.map((d) => <option key={d.id} value={d.name}>{d.name} ({d.code})</option>)}
                    </select>
                    <div style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      background: (DEPARTMENT_METADATA[form.dept] || {}).bg || "#F1F5F9",
                      color: (DEPARTMENT_METADATA[form.dept] || {}).color || "#475569",
                      fontSize: 12,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}>
                      <span>{(DEPARTMENT_METADATA[form.dept] || {}).icon || "🍽️"}</span>
                      <span>{(DEPARTMENT_METADATA[form.dept] || {}).count || ""} items</span>
                    </div>
                  </div>
                </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: "12px", color: "#475569", marginBottom: "6px", display: "block", fontWeight: 500 }}>
                  Date Needed
                </label>
                <input className="indent-field" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>

              {/* Indent Type Toggle */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: "12px", color: "#475569", marginBottom: "8px", display: "block", fontWeight: 500 }}>
                  Indent Type
                </label>
                <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #CBD5E1", background: "#F1F5F9", padding: 2 }}>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, indent_type: "routine" }))}
                    style={{
                      flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
                      transition: "all 0.18s", borderRadius: 8,
                      background: form.indent_type === "routine" ? "#059669" : "transparent",
                      color: form.indent_type === "routine" ? "#ffffff" : "#334155",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      boxShadow: form.indent_type === "routine" ? "0 1px 3px rgba(0,0,0,0.15)" : "none"
                    }}
                  >
                    <span style={{ fontSize: 14 }}>✓</span> Routine
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, indent_type: "adhoc" }))}
                    style={{
                      flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
                      transition: "all 0.18s", borderRadius: 8,
                      background: form.indent_type === "adhoc" ? "#d97706" : "transparent",
                      color: form.indent_type === "adhoc" ? "#ffffff" : "#334155",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      boxShadow: form.indent_type === "adhoc" ? "0 1px 3px rgba(0,0,0,0.15)" : "none"
                    }}
                  >
                    <span style={{ fontSize: 14 }}>⚡</span> Ad-Hoc
                  </button>
                </div>
                <p style={{ fontSize: 11, color: form.indent_type === "adhoc" ? "#92400E" : "#475569", marginTop: 6, background: form.indent_type === "adhoc" ? "#FEF3C7" : "#F1F5F9", borderRadius: 6, padding: "5px 8px" }}>
                  {form.indent_type === "adhoc"
                    ? "⚡ Emergency indent — stock is critically low or exhausted."
                    : "✓ Regular nightly indent for tomorrow's service."}
                </p>
              </div>

              {/* Quick Add Suggestions — sourced from department_items.json */}
              {form.dept && suggestedChips.length > 0 && (
                <div style={{ marginTop: 4, marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: "#6B7280", fontWeight: 500, marginBottom: 8, letterSpacing: "0.02em" }}>Quick Add Suggestions</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {suggestedChips.map(entry => {
                      const itemName = getDeptItemName(entry);
                      const itemUnit = getDeptItemUnit(entry);
                      return (
                        <button
                          key={itemName}
                          onClick={() => addSuggestionChip(entry)}
                          className="chip-suggestion"
                          title={`Add ${itemName}${itemUnit ? ` (${itemUnit})` : ""}`}
                        >
                          <span style={{ marginRight: 3, fontSize: 12, lineHeight: 1 }}>+</span>
                          {itemName}
                          {itemUnit && (
                            <span style={{
                              marginLeft: 5,
                              fontSize: 9,
                              fontWeight: 600,
                              color: "#6B7280",
                              background: "rgba(107,114,128,0.12)",
                              borderRadius: 3,
                              padding: "1px 4px",
                              letterSpacing: "0.03em",
                              textTransform: "uppercase",
                            }}>{itemUnit}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "16px", marginBottom: "16px" }}>
                <button className="action-btn primary-outline" onClick={() => setShowModal(true)} title="Open Multi-Agent Item Addition suite">
                  <Plus size={15} /> Add Item
                </button>
                <button className="action-btn secondary-outline" onClick={() => setShowModal(true)} title="Bulk Select & Add multiple items">
                  <Zap size={15} /> Add Multi
                </button>
                <button
                  className="action-btn subtle"
                  onClick={() => loadDepartmentTemplate(form.dept)}
                  disabled={loadingTemplate || !form.dept}
                  title={`Load ${form.dept || "Department"} pre-printed template`}
                >
                  <ClipboardList size={15} />
                  {loadingTemplate ? "Loading Template…" : "Load Dept Template"}
                </button>
                <button className="action-btn subtle" onClick={smartAutofill}>
                  <History size={15} /> Autofill History
                </button>
                <button onClick={startListening} className={`action-btn subtle ${listening ? 'listening' : ''}`} style={{ gridColumn: "span 2" }}>
                  <Mic size={15} color={listening ? "#EF4444" : "#475569"} />
                  {listening ? "Recording..." : "Voice Input"}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  style={{ display: "none" }}
                />
                <button
                  className="action-btn subtle"
                  onClick={handleScanClick}
                  style={{ gridColumn: "span 2" }}
                  disabled={loadingScan}
                >
                  {loadingScan ? (
                    <>
                      <div style={{ width: 14, height: 14, border: "2px solid #475569", borderTopColor: "transparent", borderRadius: "50%", marginRight: 6, display: "inline-block", verticalAlign: "middle", animation: "spin 1s linear infinite" }} />
                      Scanning… {scanProgress}%
                    </>
                  ) : (
                    <>
                      <Camera size={15} /> Scan Slip/Image
                    </>
                  )}
                </button>

                {/* Scan progress / buffering bar */}
                {loadingScan && (
                  <div style={{ gridColumn: "span 2", marginTop: 4 }}>
                    <div style={{ height: 8, background: "#E5E7EB", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{
                        width: `${scanProgress}%`, height: "100%",
                        background: "linear-gradient(90deg,#3b82f6,#22c55e)",
                        borderRadius: 999, transition: "width 0.22s ease",
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                      <span>{scanStage}</span>
                      <span>{scanProgress}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Indent Primary Action */}
              <div style={{ marginTop: "12px", marginBottom: "12px" }}>
                {msg && (
                  <div style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    background: msg.startsWith("Error") ? "#FEE2E2" : "#DCFCE7",
                    color: msg.startsWith("Error") ? "#B91C1C" : "#15803D",
                    fontSize: "12px",
                    fontWeight: 600,
                    marginBottom: "8px",
                    textAlign: "center"
                  }}>
                    {msg}
                  </div>
                )}
                <button
                  type="button"
                  className="submit-indent-btn"
                  onClick={submit}
                  disabled={form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length === 0}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    fontSize: "13px",
                    fontWeight: 700,
                    borderRadius: "8px",
                    background: form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length > 0 ? "linear-gradient(135deg, #059669, #047857)" : "#CBD5E1",
                    color: "#ffffff",
                    border: "none",
                    cursor: form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length > 0 ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length > 0 ? "0 2px 5px rgba(5,150,105,0.28)" : "none",
                    margin: 0
                  }}
                >
                  <Send size={15} />
                  Submit Indent {form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length > 0 ? `(${form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length} items)` : ""}
                </button>
              </div>

              {/* Share Order */}
              <div style={{ marginTop: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #E5E7EB" }}>
                  <span style={{ color: "var(--text-muted)", fontSize: "12px", fontWeight: 500 }}>Share Order:</span>
                  <button onClick={shareWhatsApp} className="share-btn whatsapp">
                    <WhatsAppIcon size={14} /> WhatsApp
                  </button>
                  <span style={{ color: "#E5E7EB" }}>|</span>
                  <button onClick={printSlip} className="share-btn print">
                    <Printer size={14} /> Print Slip
                  </button>
                </div>
              </div>
            </Card>
          </div>

          {/* RIGHT PANEL: The Right Department Template & Items */}
          <div className="indent-right-panel">
            <Card style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "0", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              
              {/* Template Top Header */}
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #E5E7EB", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px", background: "#1E293B" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.05em", color: "#FFFFFF", textTransform: "uppercase" }}>
                    📋 {templateStats.dept || form.dept || "Department"} Template
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "12px", background: "#334155", color: "#F8FAFC" }}>
                    {form.items.length} items
                  </span>
                  {form.items.filter(i => parseFloat(i.qty) > 0).length > 0 && (
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: "#DCFCE7", color: "#15803D" }}>
                      ✓ {form.items.filter(i => parseFloat(i.qty) > 0).length} ordered
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, maxWidth: 300, minWidth: 180, marginLeft: "auto" }}>
                  <div style={{ position: "relative", width: "100%" }}>
                    <Search size={13} color="var(--text-muted)" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    <input
                      value={tableFilter}
                      onChange={(e) => setTableFilter(e.target.value)}
                      placeholder="Filter template items (e.g. Atta, Oil)…"
                      style={{ width: "100%", padding: "5px 8px 5px 26px", fontSize: 12, border: "1px solid #CBD5E1", borderRadius: 6, outline: "none", boxSizing: "border-box", background: "white" }}
                    />
                    {tableFilter && (
                      <button
                        onClick={() => setTableFilter("")}
                        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, padding: 0 }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => loadDepartmentTemplate(form.dept)}
                    title="Reload pre-printed template from database"
                    style={{ background: "white", border: "1px solid #CBD5E1", borderRadius: 6, padding: "4px 9px", color: "#475569", fontSize: "11px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    ↺ Reload Template
                  </button>
                  <button onClick={clearAll} style={{ background: "transparent", border: "none", color: "#EF4444", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Trash2 size={13} /> Clear All
                  </button>
                </div>
              </div>

              {/* Multi-Agent Assistant & Quick Automation Action Bar */}
              <div style={{
                background: "#0F172A",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                padding: "8px 16px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px"
              }}>
                {/* Left: Multi-Agent AI Automation */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#E8A838", fontWeight: 700, letterSpacing: "0.03em", marginRight: 2 }}>
                    <Sparkles size={13} /> Multi-Agent Engine:
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoFillRecommendations}
                    disabled={loadingRecommendations}
                    title="Calculates moving weekday consumption averages for this department and auto-fills template quantities"
                    style={{
                      background: "linear-gradient(135deg, rgba(232, 168, 56, 0.2), rgba(232, 168, 56, 0.08))",
                      border: "1px solid #E8A838",
                      color: "#FDE68A",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      transition: "all 0.15s ease"
                    }}
                  >
                    <Zap size={12} style={{ color: "#E8A838" }} />
                    {loadingRecommendations ? "Predicting..." : "⚡ Auto-Fill Weekday Par"}
                  </button>

                  <button
                    type="button"
                    onClick={handleResetQuantities}
                    title="Reset all ordered quantities to zero without removing template items"
                    style={{
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "#94A3B8",
                      padding: "4px 9px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <RotateCcw size={11} /> Reset Qty
                  </button>
                </div>

                {/* Right: Smart Filter Chips */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>Filter:</span>
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    style={{
                      background: filterMode === "all" ? "#3B82F6" : "rgba(255, 255, 255, 0.08)",
                      color: filterMode === "all" ? "#FFFFFF" : "#CBD5E1",
                      border: filterMode === "all" ? "1px solid #3B82F6" : "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: 12,
                      padding: "2px 9px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    All ({form.items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("ordered")}
                    style={{
                      background: filterMode === "ordered" ? "#059669" : "rgba(16, 185, 129, 0.15)",
                      color: filterMode === "ordered" ? "#FFFFFF" : "#34D399",
                      border: `1px solid ${filterMode === "ordered" ? "#059669" : "rgba(16, 185, 129, 0.35)"}`,
                      borderRadius: 12,
                      padding: "2px 9px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    ✓ Ordered ({form.items.filter(i => parseFloat(i.qty) > 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("low_stock")}
                    style={{
                      background: filterMode === "low_stock" ? "#D97706" : "rgba(217, 119, 6, 0.15)",
                      color: filterMode === "low_stock" ? "#FFFFFF" : "#FBBF24",
                      border: `1px solid ${filterMode === "low_stock" ? "#D97706" : "rgba(217, 119, 6, 0.35)"}`,
                      borderRadius: 12,
                      padding: "2px 9px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer"
                    }}
                  >
                    ⚠️ Low / Out Stock ({form.items.filter(i => {
                      const cleanName = (i.name || "").toLowerCase().trim();
                      const availObj = availableStock[cleanName];
                      const avail = availObj?.available ?? availObj ?? i.current_stock;
                      return avail !== undefined && avail !== null && Number(avail) <= 15;
                    }).length})
                  </button>
                </div>
              </div>

              {/* Template Items Table */}
              <div className="table-container resp-table-wrap" style={{ flex: 1, overflowY: "auto", maxHeight: "520px" }}>
                <table className="excel-table">
                  <colgroup>
                    <col style={{ width: "35px" }} />
                    <col style={{ width: "80px" }} />
                    <col style={{ width: "auto" }} />
                    <col style={{ width: "135px" }} />
                    <col style={{ width: "85px" }} />
                    <col style={{ width: "155px" }} />
                    <col style={{ width: "70px" }} />
                    <col style={{ width: "95px" }} />
                    <col style={{ width: "110px" }} />
                    <col style={{ width: "35px" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Central Store Stock</th>
                      <th>Rate</th>
                      <th>Order Qty</th>
                      <th>Unit</th>
                      <th style={{ textAlign: "right" }}>Line Total</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let displayed = form.items;

                      // Apply Mode Filters
                      if (filterMode === "ordered") {
                        displayed = displayed.filter(it => parseFloat(it.qty) > 0);
                      } else if (filterMode === "low_stock") {
                        displayed = displayed.filter(it => {
                          const cleanName = (it.name || "").toLowerCase().trim();
                          const availObj = availableStock[cleanName];
                          const avail = availObj?.available ?? availObj ?? it.current_stock;
                          return avail !== undefined && avail !== null && Number(avail) <= 15;
                        });
                      }

                      // Apply Text Search Filter
                      if (tableFilter.trim()) {
                        const q = tableFilter.toLowerCase().trim();
                        displayed = displayed.filter(it => (it.name || "").toLowerCase().includes(q) || (it.item_code || "").toLowerCase().includes(q));
                      }

                      if (displayed.length === 0) {
                        return (
                          <tr>
                            <td colSpan="10" style={{ textAlign: "center", padding: "40px 20px" }}>
                              <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                                {filterMode === "ordered"
                                  ? "No ordered items yet. Increase quantities using the [+] buttons or enter a quantity to add."
                                  : filterMode === "low_stock"
                                  ? "No items currently flagged as low or out of stock in Central Store."
                                  : tableFilter
                                  ? `No template items matching "${tableFilter}"`
                                  : "No items in list. Click 'Reload Template' or '+ Add Item' to start."}
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      return displayed.map((item) => {
                        const originalIdx = form.items.findIndex(it => it.id === item.id);
                        const idx = originalIdx !== -1 ? originalIdx : 0;
                        const cleanName = (item.name || "").toLowerCase().trim();
                        const availObj = availableStock[cleanName];
                        const avail = availObj?.available ?? availObj ?? item.current_stock;
                        const isStockCheckActive = item.name && avail !== undefined && avail !== null;
                        const isOutStock = isStockCheckActive && Number(avail) <= 0;
                        const isLowStock = isStockCheckActive && (Number(avail) <= 15 || item.is_low_stock);
                        const isNewItem = item.item_code === "KPL-NEW" || !item.item_code;
                        const isActive = activeRowIdx === idx;
                        const isQtyMissing = item.qtyMissing || (item.qty === "" && item.name);

                        const itemRate = getItemRate(stocks, item, availableStock);
                        const lineCost = getLineCost(stocks, item, availableStock);

                        const confidence = isNewItem ? "red" : (item.matchVia === "fuzzy" ? "yellow" : "green");
                        const isLowConfidence = item.confidence !== undefined && item.confidence < 0.7;

                        return (
                          <tr
                            key={item.id || idx}
                            className={`excel-row ${isActive ? 'active-row' : ''}`}
                            onClick={() => setActiveRowIdx(idx)}
                            style={isQtyMissing ? { background: "#fffbeb", borderLeft: "3px solid #f59e0b" } : {}}
                          >
                            <td className="row-num">{item.row_no || (idx + 1)}</td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <span
                                  className={`kpl-badge ${isNewItem ? 'new' : 'existing'}`}
                                  title={confidence === "red" ? "No match — pick the real item" : confidence === "yellow" ? "Fuzzy match — verify this is correct" : "Confirmed match"}
                                  style={{ boxShadow: `inset 3px 0 0 ${confidence === "red" ? "#EF4444" : confidence === "yellow" ? "#F59E0B" : "#10B981"}` }}
                                >
                                  {item.item_code || "NEW"}
                                </span>
                                {isLowConfidence && (
                                  <span style={{ background: "#FEF3C7", color: "#D97706", fontSize: "10px", padding: "2px 4px", borderRadius: "4px", fontWeight: 700 }} title={`OCR read with low confidence: ${(item.confidence * 100).toFixed(0)}%`}>
                                    ⚠️ Low
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ position: "relative" }}>
                              <ItemNameCombobox
                                value={item.name}
                                dept={form.dept}
                                deptItems={allStockNames}
                                deptJsonItems={deptJsonItems}
                                stocks={stocks}
                                autoFocus={isActive}
                                onChange={(val) => updateItem(idx, "name", val)}
                                onSelect={(name) => selectComboItem(idx, name)}
                              />
                              {item.suggestedName && (
                                <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 2 }}>
                                  Did you mean <button type="button" onClick={(e) => { e.stopPropagation(); selectComboItem(idx, item.suggestedName); }} style={{ background: "none", border: "none", padding: 0, color: "#B45309", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{item.suggestedName}</button>?
                                </div>
                              )}
                            </td>

                            {/* Enhanced Central Store Inventory */}
                            <td style={{ padding: "6px 8px" }}>
                              {isStockCheckActive || item.current_stock !== undefined ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>
                                    {Number(avail || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 })} {availObj?.unit || item.unit}
                                  </span>
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 3,
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                      width: "fit-content",
                                      background: isOutStock ? "#FEE2E2" : (isLowStock ? "#FEF3C7" : "#DCFCE7"),
                                      color: isOutStock ? "#DC2626" : (isLowStock ? "#D97706" : "#15803D"),
                                      border: `1px solid ${isOutStock ? "#FCA5A5" : (isLowStock ? "#FCD34D" : "#86EFAC")}`
                                    }}
                                    title={`Live Central Store inventory: ${avail} ${item.unit}`}
                                  >
                                    {isOutStock ? "✕ Out of Stock" : (isLowStock ? "⚡ Low Stock" : "✓ In Stock")}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: "#94A3B8", fontSize: 11 }}>—</span>
                              )}
                            </td>

                            {/* Catalog Rate */}
                            <td style={{ padding: "6px 8px" }}>
                              {itemRate > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column" }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#B45309" }}>
                                    ₹{itemRate.toFixed(2)}
                                  </span>
                                  <span style={{ fontSize: 10, color: "#64748B" }}>
                                    per {item.unit}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: "#94A3B8", fontSize: 11 }} title="Catalog rate not set">₹0.00</span>
                              )}
                            </td>

                            {/* Order Qty with Touch Stepper & Preset Pills */}
                            <td style={{ padding: "4px 6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); stepQty(idx, -1); }}
                                  className="stepper-btn minus"
                                  title="Decrease quantity by 1"
                                >
                                  –
                                </button>
                                <input
                                  type="number"
                                  value={item.qty}
                                  onChange={(e) => updateItem(idx, "qty", e.target.value)}
                                  className="excel-input stepper-input"
                                  placeholder={isQtyMissing ? "Fill qty" : "0"}
                                  style={{
                                    width: 54,
                                    textAlign: "center",
                                    padding: "6px 4px",
                                    borderRadius: 6,
                                    border: parseFloat(item.qty) > 0 ? "1.5px solid #10B981" : (isQtyMissing ? "1.5px solid #F59E0B" : "1px solid #CBD5E1"),
                                    background: parseFloat(item.qty) > 0 ? "#F0FDF4" : (isQtyMissing ? "#FEF3C7" : "#FFFFFF"),
                                    fontWeight: parseFloat(item.qty) > 0 ? 800 : 500,
                                    color: parseFloat(item.qty) > 0 ? "#15803D" : (isQtyMissing ? "#92400E" : "#1E293B"),
                                    fontSize: 13
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); stepQty(idx, 1); }}
                                  className="stepper-btn plus"
                                  title="Increase quantity by 1"
                                >
                                  +
                                </button>
                              </div>

                              {/* Quick 1-Tap Preset Increment Chips */}
                              <div style={{ display: "flex", gap: 2, marginTop: 4 }}>
                                {[1, 5, 10, 25].map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); addPresetQty(idx, preset); }}
                                    className="preset-chip"
                                    title={`Add ${preset} ${item.unit}`}
                                  >
                                    +{preset}
                                  </button>
                                ))}
                              </div>
                            </td>

                            {/* Unit Selector */}
                            <td>
                              <select
                                value={item.unit}
                                onChange={(e) => updateItem(idx, "unit", e.target.value)}
                                className="excel-input"
                                style={{ padding: "6px 4px", fontSize: 12 }}
                              >
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>

                            {/* Live Line Total Cost */}
                            <td style={{ padding: "6px 8px", textAlign: "right" }}>
                              {lineCost > 0 ? (
                                <span style={{ fontSize: 12, fontWeight: 800, color: "#15803D", background: "#DCFCE7", padding: "3px 6px", borderRadius: 4 }}>
                                  ₹{lineCost.toFixed(2)}
                                </span>
                              ) : (
                                <span style={{ color: "#94A3B8", fontSize: 11 }}>—</span>
                              )}
                            </td>

                            {/* Notes */}
                            <td>
                              <input
                                value={item.notes || ""}
                                onChange={(e) => updateItem(idx, "notes", e.target.value)}
                                placeholder="Notes..."
                                className="excel-input"
                                style={{ padding: "6px 8px", fontSize: 12 }}
                              />
                            </td>

                            {/* Action / Delete */}
                            <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                              <button onClick={(e) => { e.stopPropagation(); removeRow(idx); }} className="row-delete-btn" title="Remove item row">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Enhanced Sticky Summary & Budget Live Bar */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid #E2E8F0", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", background: "#F8FAFC" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px" }}>
                  <button onClick={addRow} className="add-row-btn" style={{ width: "auto", padding: "6px 12px", borderRadius: 6, border: "1px dashed #CBD5E1", background: "white", color: "#1E293B", fontWeight: 600, fontSize: 12 }}>
                    + Add Row
                  </button>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                    Total Template Items: <strong>{form.items.filter(i => i.name).length}</strong>
                  </div>
                  {form.items.filter(i => parseFloat(i.qty) > 0).length > 0 && (
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#15803D", background: "#DCFCE7", padding: "2px 8px", borderRadius: 12 }}>
                      ✓ {form.items.filter(i => parseFloat(i.qty) > 0).length} Ordered
                    </div>
                  )}
                  <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", background: "#FEF3C7", border: "1px solid #FCD34D", padding: "4px 10px", borderRadius: 6 }}>
                    Est. Total Cost: ₹{form.items.reduce((sum, item) => sum + getLineCost(stocks, item, availableStock), 0).toFixed(2)}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {msg && <span style={{ color: COLORS.success, fontSize: 12, fontWeight: 600 }}>{msg}</span>}
                  <button
                    type="button"
                    className="submit-indent-btn"
                    onClick={submit}
                    disabled={form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length === 0}
                    style={{
                      width: "auto",
                      padding: "8px 24px",
                      margin: 0,
                      background: form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length > 0 ? "linear-gradient(135deg, #059669, #047857)" : "#CBD5E1",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 13,
                      boxShadow: form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length > 0 ? "0 2px 6px rgba(5,150,105,0.3)" : "none",
                      cursor: form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length > 0 ? "pointer" : "not-allowed"
                    }}
                  >
                    Submit Indent {form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length > 0 ? `(${form.items.filter((i) => i.name && parseFloat(i.qty) > 0).length} items · ₹${form.items.reduce((sum, item) => sum + getLineCost(stocks, item, availableStock), 0).toFixed(0)})` : ""}
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
        </div>
        ) : activeTab === "smart" ? (
          <SmartIndentTab
            dept={form.dept}
            date={form.date}
            stocks={stocks}
            onCompile={(compiledItems) => {
              setForm(f => ({ ...f, items: compiledItems }));
              setActiveTab("manual");
              fetchStockLevels(compiledItems.map(it => it.name));
              setMsg("Smart indent compiled — review and submit below. ✓");
              setTimeout(() => setMsg(""), 4000);
            }}
             onSubmitSuccess={() => {
               load({ page: 1 });
               if (isStoreManager) {
                 setMsg("Indent submitted! Redirecting to Issuance... ✓");
                 setTimeout(() => {
                   setMsg("");
                   setCurrentScreen("store_manager_store_issuance");
                 }, 1500);
               } else if (hasPermission && hasPermission("issuances.create")) {
                 setMsg("Indent submitted! Redirecting to Issuance... ✓");
                 setTimeout(() => {
                   setMsg("");
                   setCurrentScreen("issuance");
                 }, 1500);
               } else {
                 setMsg("Indent submitted directly from Smart tab ✓");
                 setTimeout(() => setMsg(""), 4000);
               }
             }}
          />
        ) : isStoreManager && activeTab === "history" ? (
          <div className="indent-history-section" style={{ width: "100%", marginTop: "8px" }}>
            <Card style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: "12px", padding: "20px 24px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between", alignItems: "center", marginBottom: isHistoryExpanded ? "16px" : "0" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", margin: 0, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}>
                  📋 All Indents Register (Master History)
                  {isHistoryExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </h2>
              {isHistoryExpanded && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ position: "relative" }}>
                    <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
                    <input
                      value={historySearch}
                      onChange={(e) => { setHistorySearch(e.target.value); if (!e.target.value) load({ page: 1, q: "" }); }}
                      placeholder="Search items…"
                      style={{ padding: "7px 10px 7px 32px", border: "1px solid #D1D5DB", borderRadius: "8px", background: "#F9FAFB", fontSize: "12px", outline: "none", width: "180px" }}
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); load({ page: 1, status: e.target.value }); }}
                    style={{ padding: "7px 10px", border: "1px solid #D1D5DB", borderRadius: "8px", background: "#F9FAFB", fontSize: "12px", outline: "none" }}
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="issued">Issued</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button onClick={() => load({ page: 1, q: historySearch.trim() })} style={{ padding: "7px 14px", background: "#1D3557", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", cursor: "pointer" }}>
                    Search
                  </button>
                </div>
              )}
            </div>

            {isHistoryExpanded && (
              <>
                {loading ? <p style={{ color: COLORS.muted, textAlign: "center", padding: 32 }}>Loading…</p> : error ? <ErrorMsg error={error} /> : (
                  <>
                    <div className="resp-table-wrap" style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: "#F9FAFB", position: "sticky", top: 0, zIndex: 1 }}>
                            {(() => {
                              const headers = ["#", "Department", "Date", "Type", "Item Code", "Item Name", "Qty", "Unit", "Status"];
                              if (hasPermission && hasPermission("indents.delete")) {
                                headers.push("Actions");
                              }
                              return headers.map((h) => (
                                <th key={h} style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #E5E7EB", borderRight: "1px solid #E5E7EB", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                              ));
                            })()}
                          </tr>
                        </thead>
                        <tbody>
                          {items.length === 0 ? (
                            <tr>
                              <td colSpan={hasPermission && hasPermission("indents.delete") ? 10 : 9} style={{ textAlign: "center", padding: "40px 20px" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                                  <Inbox size={32} color="#D1D5DB" />
                                  <span style={{ fontSize: "13px", color: "#9CA3AF", marginTop: "8px" }}>No indent requests found</span>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            items.flatMap((ind, indIdx) => {
                              const statusInfo = getStatusStyleAndText(ind.status);
                              const isAdhoc = (ind.indent_type || "routine") === "adhoc";
                              const indItems = ind.items && ind.items.length > 0 ? ind.items : [];
                              const rowCount = indItems.length;
                              const groupBg = indIdx % 2 === 0 ? "#ffffff" : "#F9FAFB";
                              const isExpanded = expandedIndentIds.has(ind.id);

                              const hasDel = hasPermission && hasPermission("indents.delete");
                              const actionsContent = hasDel ? (
                                ind.status !== "issued" && ind.status !== "partially_issued" ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteIndent(ind.id); }}
                                    style={{
                                      background: "#fee2e2", color: "#ef4444", border: "1px solid #fca5a5",
                                      padding: "4px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, cursor: "pointer"
                                    }}
                                  >
                                    Delete
                                  </button>
                                ) : (
                                  <span style={{ fontSize: "11px", color: "#9ca3af" }} title="Issuance done — cannot delete">issued</span>
                                )
                              ) : null;

                              const rows = [];
                              
                              // SUMMARY ROW
                              rows.push(
                                <tr key={`summary-${ind.id}`} style={{ background: groupBg, borderBottom: isExpanded ? "none" : "2px solid #E5E7EB", cursor: "pointer" }} onClick={() => toggleIndentAccordion(ind.id)}>
                                  <td style={{ padding: "8px 10px", verticalAlign: "middle", borderRight: "1px solid #E5E7EB", color: "var(--text-muted)", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", borderLeft: `3px solid ${isAdhoc ? "#f59e0b" : "#22c55e"}` }}>
                                    {indIdx + 1}
                                  </td>
                                  <td style={{ padding: "8px 10px", verticalAlign: "middle", borderRight: "1px solid #E5E7EB", fontWeight: 600, color: "#111827", fontSize: 12, whiteSpace: "nowrap" }}>
                                    {cleanDeptName(ind.dept)}
                                  </td>
                                  <td style={{ padding: "8px 10px", verticalAlign: "middle", borderRight: "1px solid #E5E7EB", color: "#6B7280", fontSize: 11, whiteSpace: "nowrap" }}>
                                    {formatDate(ind.date)}
                                  </td>
                                  <td style={{ padding: "8px 10px", verticalAlign: "middle", borderRight: "1px solid #E5E7EB" }}>
                                    <span style={{
                                      display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                                      background: isAdhoc ? "#FEF3C7" : "#D1FAE5", color: isAdhoc ? "#92400E" : "#065F46",
                                      border: `1px solid ${isAdhoc ? "#FCD34D" : "#6EE7B7"}`, whiteSpace: "nowrap",
                                    }}>
                                      {isAdhoc ? "⚡ Ad-Hoc" : "✓ Routine"}
                                    </span>
                                  </td>
                                  
                                  {/* Merged Items Column */}
                                  <td colSpan={4} style={{ padding: "8px 10px", verticalAlign: "middle", borderRight: "1px solid #E5E7EB", textAlign: "center", color: "#3b82f6", fontSize: 11, fontWeight: 600 }}>
                                    {rowCount} Items (Click to {isExpanded ? "collapse" : "expand"}) <span style={{fontSize: 9}}>{isExpanded ? "▲" : "▼"}</span>
                                  </td>
                                  
                                  <td style={{ padding: "8px 10px", verticalAlign: "middle", textAlign: "center", borderRight: hasDel ? "1px solid #E5E7EB" : "none" }}>
                                    <span style={{ background: statusInfo.bg, color: statusInfo.color, padding: "3px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: 600, display: "inline-block", whiteSpace: "nowrap" }}>{statusInfo.text}</span>
                                  </td>
                                  {hasDel && (
                                    <td style={{ padding: "8px 10px", verticalAlign: "middle", textAlign: "center" }}>
                                      {actionsContent}
                                    </td>
                                  )}
                                </tr>
                              );

                              if (isExpanded) {
                                if (rowCount === 0) {
                                  rows.push(
                                    <tr key={`empty-${ind.id}`} style={{ background: "#f8fafc", borderBottom: "2px solid #E5E7EB" }}>
                                      <td colSpan={4} style={{ borderRight: "1px solid #E5E7EB", borderLeft: `3px solid ${isAdhoc ? "#f59e0b" : "#22c55e"}` }}></td>
                                      <td colSpan={4} style={{ padding: "12px", textAlign: "center", fontSize: 11, color: "#9ca3af", borderRight: "1px solid #E5E7EB" }}>No items found</td>
                                      <td colSpan={hasDel ? 2 : 1}></td>
                                    </tr>
                                  );
                                } else {
                                  indItems.forEach((it, itIdx) => {
                                    rows.push(
                                      <tr key={`item-${ind.id}-${itIdx}`} style={{ background: "#fcfcfc", borderBottom: itIdx === rowCount - 1 ? "2px solid #E5E7EB" : "1px solid #F3F4F6" }}>
                                        <td colSpan={4} style={{ borderRight: "1px solid #E5E7EB", borderLeft: `3px solid ${isAdhoc ? "#f59e0b" : "#22c55e"}` }}></td>
                                        <td style={{ padding: "6px 10px", borderRight: "1px solid #E5E7EB", fontFamily: "monospace", fontSize: 10, color: "#6B7280", whiteSpace: "nowrap" }}>{it.item_code || "—"}</td>
                                        <td style={{ padding: "6px 10px", borderRight: "1px solid #E5E7EB", color: "#1e293b", fontWeight: 500, minWidth: 160 }}>{it.name}</td>
                                        <td style={{ padding: "6px 10px", borderRight: "1px solid #E5E7EB", color: "#374151", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{it.qty}</td>
                                        <td style={{ padding: "6px 10px", borderRight: "1px solid #E5E7EB", color: "#6B7280", fontSize: 11, whiteSpace: "nowrap" }}>{it.unit || "kg"}</td>
                                        <td style={{ borderRight: hasDel ? "1px solid #E5E7EB" : "none" }}></td>
                                        {hasDel && <td></td>}
                                      </tr>
                                    );
                                  });
                                }
                              }

                              return rows;
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                    {items.length > 0 && <Pagination page={page} total={total} limit={LIMIT} onPage={(p) => load({ page: p })} />}
                  </>
                )}
              </>
            )}
          </Card>
        </div>
        ) : null}

        {/* Multi-Agent Enhanced Item Addition Master Suite */}
        <EnhancedItemAdditionModal
          open={showModal}
          onClose={() => setShowModal(false)}
          dept={form.dept}
          existingItems={form.items}
          stocks={stocks}
          deptItemsMap={deptItemsMap}
          availableStock={availableStock}
          onAddItems={handleAddEnhancedItems}
          onAddTemplateItem={handleAddTemplateItem}
        />

      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .indent-page-wrapper {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .indent-top-section {
          display: flex;
          gap: 16px;
        }
        .indent-left-panel {
          width: 35%;
          min-width: 320px;
          align-self: flex-start;
          position: sticky;
          top: 16px;
        }
        .indent-right-panel {
          width: 65%;
        }

        @media (max-width: 767px) {
          .indent-top-section {
            flex-direction: column;
            height: auto;
            min-height: unset;
          }
          .indent-left-panel, .indent-right-panel {
            width: 100%;
            min-width: 100%;
            position: static;
          }
        }
        .indent-history-section {
          width: 100%;
        }
        
        .indent-field {
          width: 100%; padding: 8px 12px; border: 1px solid #E2E8F0; border-radius: 8px; background: #fff; font-size: 13px; outline: none; transition: border-color 0.15s;
        }
        .indent-field:focus { border-color: #3b82f6; }
        
        .chip-suggestion {
          background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 999px; padding: 4px 12px;
          font-size: 12px; color: #15803D; cursor: pointer; font-weight: 500; transition: all 0.15s;
          display: inline-flex; align-items: center; gap: 2px;
        }
        .chip-suggestion:hover { background: #DCFCE7; border-color: #86EFAC; }

        /* Item Name Combobox */
        .item-combobox-wrap { position: relative; width: 100%; height: 100%; }
        .item-combobox-input { width: 100%; height: 100%; border: none; background: transparent; padding: 10px; font-size: 13px; color: #1e293b; outline: none; box-sizing: border-box; }
        .item-combobox-input:focus { background: white; }
        .item-combobox-dropdown {
          position: absolute; top: calc(100% + 2px); left: -1px; right: -1px;
          background: #fff; border: 1px solid #E5E7EB; border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.10); z-index: 9999;
          max-height: 200px; overflow-y: auto;
        }
        .item-combobox-option {
          padding: 8px 12px; font-size: 13px; display: flex; justify-content: space-between;
          align-items: center; cursor: pointer; transition: background 0.1s;
        }
        .item-combobox-option:hover, .item-combobox-option.active { background: #F9FAFB; }
        .item-combobox-empty { padding: 10px 12px; font-size: 12px; color: #9CA3AF; }
        
        .action-btn {
          padding: 8px 10px; border-radius: 8px; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; transition: all 0.15s; font-weight: 500; height: 40px;
        }
        .action-btn.primary-outline { border: 1px solid #1e293b; background: white; color: #1e293b; }
        .action-btn.primary-outline:hover { background: #f8fafc; }
        .action-btn.secondary-outline { border: 1px solid #cbd5e1; background: white; color: #475569; }
        .action-btn.secondary-outline:hover { background: #f8fafc; }
        .action-btn.subtle { border: 1px solid transparent; background: #f1f5f9; color: #475569; }
        .action-btn.subtle:hover { background: #e2e8f0; }
        .action-btn.subtle.listening { background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; }

        .submit-indent-btn {
          width: 100%; padding: 12px; background: #1a1a2e; color: white; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
        }
        .submit-indent-btn:hover { opacity: 0.9; }
        .submit-indent-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .share-btn { background: transparent; border: none; font-size: 12px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 4px; padding: 0; }
        .share-btn.whatsapp { color: #22c55e; }
        .share-btn.print { color: #475569; }
        
        /* Excel Table Styles */
        .table-container { scrollbar-width: thin; }
        .excel-table { width: 100%; border-collapse: collapse; }
        .excel-table th { background: #f8fafc; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 6px 10px; font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; text-align: left; position: sticky; top: 0; z-index: 2; }
        .excel-table td { border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 0; position: relative; }
        .excel-table tr.excel-row:nth-child(even) { background-color: #fafafa; }
        .excel-table tr.excel-row:hover { background-color: #f1f5f9; }
        .excel-table tr.active-row td { border-top: 2px solid #3b82f6; border-bottom: 2px solid #3b82f6; }
        .excel-table tr.active-row td:first-child { border-left: 2px solid #3b82f6; }
        .excel-table tr.active-row td:last-child { border-right: 2px solid #3b82f6; }
        
        .row-num { padding: 8px 10px !important; color: #94a3b8; font-size: 11px; text-align: center; }
        
        .kpl-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 10px; }
        .kpl-badge.existing { background: #e2e8f0; color: #475569; }
        .kpl-badge.new { background: #fef3c7; color: #d97706; }
        
        .excel-input { width: 100%; height: 100%; border: none; background: transparent; padding: 10px; font-size: 13px; color: #1e293b; outline: none; box-sizing: border-box; }
        .excel-input:focus { background: white; }
        
        .stock-cell { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-left: 10px; }
        .stock-cell.ok { color: #16a34a; background: #dcfce7; }
        .stock-cell.low { color: #dc2626; background: #fee2e2; }

        .row-delete-btn { background: transparent; border: none; color: #ef4444; padding: 8px; cursor: pointer; opacity: 0; transition: opacity 0.15s; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .excel-row:hover .row-delete-btn { opacity: 1; }

        .add-row-btn { width: 100%; padding: 8px; text-align: left; background: transparent; border: 1px dashed transparent; color: #64748b; font-size: 13px; cursor: pointer; transition: all 0.15s; font-weight: 500; }
        .add-row-btn:hover { border-color: #cbd5e1; background: white; color: #1e293b; }

        .stepper-btn {
          width: 24px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          border: 1px solid #CBD5E1;
          background: #F8FAFC;
          color: #1E293B;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.12s ease;
          user-select: none;
          touch-action: manipulation;
          padding: 0;
        }
        .stepper-btn:hover {
          background: #E2E8F0;
          border-color: #94A3B8;
        }
        .stepper-btn:active {
          transform: scale(0.92);
        }
        .stepper-btn.plus {
          background: #DCFCE7;
          border-color: #86EFAC;
          color: #15803D;
        }
        .stepper-btn.plus:hover {
          background: #BBF7D0;
        }
        .stepper-btn.minus {
          background: #F1F5F9;
          color: #64748B;
        }
        .preset-chip {
          padding: 1px 5px;
          font-size: 10px;
          font-weight: 700;
          border-radius: 4px;
          background: #F1F5F9;
          border: 1px solid #CBD5E1;
          color: #475569;
          cursor: pointer;
          transition: all 0.1s ease;
          touch-action: manipulation;
        }
        .preset-chip:hover {
          background: #E2E8F0;
          color: #0F172A;
          border-color: #94A3B8;
        }
        .preset-chip:active {
          transform: scale(0.92);
          background: #CBD5E1;
        }

        @media (max-width: 1024px) {
          .indent-top-section { flex-direction: column; height: auto; }
          .indent-left-panel, .indent-right-panel { width: 100%; }
          .indent-right-panel { min-height: 400px; }
        }
      `}}/>
    </Section>
  );
}
