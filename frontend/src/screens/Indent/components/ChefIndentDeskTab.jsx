import { useState, useEffect } from "react";
import Card from "../../../components/Card";
import Btn from "../../../components/Btn";
import Input from "../../../components/Input";
import Select from "../../../components/Select";
import ErrorMsg from "../../../components/ErrorMsg";
import { COLORS } from "../../../styles/colors";
import * as api from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import {
  UtensilsCrossed,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  Layers,
  Sparkles,
  Bot,
  RefreshCw,
  Search,
  Filter,
  FileText,
  Send,
  Check,
  X,
  Printer,
  Copy,
  CheckCheck,
  TrendingUp,
  ShieldCheck,
  Building2,
  Calendar,
  SlidersHorizontal,
  ChevronDown,
  Scale,
  Eye,
  Tag,
  Flame,
  AlertTriangle,
  Minus,
  RotateCcw,
  Trash2,
  Mic,
  MicOff,
  MessageSquare,
  Download,
} from "lucide-react";

export const CANONICAL_DEPTS = [
  "TIFFINS",
  "STAFF",
  "SI-MEALS",
  "NORTH INDIAN",
  "CHAT & SOFTY",
  "CHINESE & DOSA",
  "MOCKTAILS & CONTINENTAL",
  "RESTAURANT",
  "ROOM SERVICE",
];

// Requisition Draft Cache (holds half-saved chef requisitions for 2 hours)
const CHEF_DRAFT_KEY = (dept) => `kapila_chef_draft_${(dept || "GENERAL").toUpperCase()}`;
const CHEF_DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours holding window

const loadChefDraft = (dept) => {
  try {
    const raw = localStorage.getItem(CHEF_DRAFT_KEY(dept));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.timestamp || Date.now() - parsed.timestamp > CHEF_DRAFT_TTL_MS) {
      localStorage.removeItem(CHEF_DRAFT_KEY(dept));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const saveChefDraft = (dept, data) => {
  try {
    localStorage.setItem(CHEF_DRAFT_KEY(dept), JSON.stringify({
      ...data,
      timestamp: Date.now(),
    }));
  } catch {}
};

const clearChefDraft = (dept) => {
  try {
    localStorage.removeItem(CHEF_DRAFT_KEY(dept));
  } catch {}
};

// Requisition Slip Printable Generator (Multi-Agent Layout)
export const printRequisitionSlip = (indent) => {
  if (!indent) return;
  const escapeHtml = (unsafe) => {
    return (unsafe || "").toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const formatDate = (d) => {
    try {
      const dateObj = new Date(d || Date.now());
      return dateObj.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(d || "Today");
    }
  };

  const items = indent.items || [];
  const isDisposable = (it) => {
    const cat = (it.category || "").toLowerCase();
    const name = (it.name || "").toLowerCase();
    return cat.includes("dispos") || cat.includes("pack") || [
      "container", "box", "cup", "plate", "foil", "cling", "cover", "bag",
      "paper", "napkin", "tissue", "straw", "spoon", "fork", "glove", "3cp", "5cp", "8cp"
    ].some((kw) => name.includes(kw));
  };

  const ingredients = items.filter((it) => !isDisposable(it));
  const disposables = items.filter((it) => isDisposable(it));

  const renderItemRows = (list, offset = 0) => {
    if (list.length === 0) {
      return `<tr><td colspan="6" style="padding:10px;text-align:center;color:#64748b;font-style:italic;">No items specified in this section for this shift.</td></tr>`;
    }
    return list
      .map((it, idx) => {
        const qty = parseFloat(it.qty ?? it.requestedQty) || 0;
        const rate = parseFloat(it.price ?? it.cost ?? it.unit_price) || 0;
        const total = qty * rate;
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; ${idx % 2 === 1 ? "background:#f8fafc;" : ""}">
            <td style="padding: 6px 8px; text-align: center; font-weight: 500; font-size: 11px;">${offset + idx + 1}</td>
            <td style="padding: 6px 8px; font-weight: 600; font-size: 11px; color: #0f172a;">
              ${escapeHtml(it.name)}
              ${it.notes ? `<div style="font-size: 9px; color: #d97706; font-style: italic;">Note: ${escapeHtml(it.notes)}</div>` : ""}
            </td>
            <td style="padding: 6px 8px; font-size: 10px; color: #64748b;">${escapeHtml(it.category || (isDisposable(it) ? "Packaging" : "Grocery"))}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; font-size: 11px; color: #0f172a;">${qty} <span style="font-weight: 400; font-size: 9px; color: #64748b;">${escapeHtml(it.unit || "kg")}</span></td>
            <td style="padding: 6px 8px; text-align: right; font-size: 11px; color: #475569;">${rate > 0 ? `₹${rate.toFixed(2)}` : "—"}</td>
            <td style="padding: 6px 8px; text-align: right; font-weight: 700; font-size: 11px; color: #15803d;">${total > 0 ? `₹${total.toFixed(2)}` : "—"}</td>
          </tr>
        `;
      })
      .join("");
  };

  const calcTotal = (list) =>
    list.reduce((sum, it) => sum + (parseFloat(it.qty ?? it.requestedQty) || 0) * (parseFloat(it.price ?? it.cost ?? it.unit_price) || 0), 0);
  const ingTotal = calcTotal(ingredients);
  const dispTotal = calcTotal(disposables);
  const grandTotal = ingTotal + dispTotal;

  const trackingId = indent.trackingNumber || (indent.id ? `IND-${indent.id}` : `DRAFT-${Date.now().toString().slice(-4)}`);

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to preview and print requisition slips.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Material Requisition Slip - ${escapeHtml(indent.dept || "Store")} (#${trackingId})</title>
        <style>
          @page { size: A4; margin: 10mm 12mm; }
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 16px; color: #0f172a; margin: 0; background: #fff; line-height: 1.35; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
          .hotel-name { font-size: 19px; font-weight: 800; letter-spacing: 0.04em; color: #0f172a; margin: 0; }
          .hotel-sub { font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 2px; }
          .badge-box { text-align: right; }
          .slip-title { font-size: 14px; font-weight: 800; color: #1e293b; letter-spacing: 0.03em; text-transform: uppercase; margin: 0; }
          .tracking-pill { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: 800; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; margin-top: 3px; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; }
          .meta-item strong { display: block; color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
          .notes-box { background: #fffbeb; border: 1.5px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 7px 12px; margin-bottom: 12px; font-size: 11px; color: #92400e; font-weight: 600; }
          .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 5px 8px; background: #1e293b; color: #fff; border-radius: 4px 4px 0 0; margin-top: 10px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 4px; border: 1px solid #cbd5e1; }
          th { background: #f1f5f9; padding: 5px 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 1.5px solid #cbd5e1; text-align: left; }
          .grand-total-card { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; border-radius: 6px; padding: 8px 14px; margin: 12px 0; }
          .grand-total-val { font-size: 15px; font-weight: 800; color: #34d399; }
          .sign-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; }
          .sign-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; text-align: center; }
          .sign-box-title { font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase; background: #f8fafc; padding: 2px 0; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; }
          .sign-line { font-size: 8px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 3px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="hotel-name">HOTEL KAPILA</h1>
            <div class="hotel-sub">Central Stores & Kitchen Material Management System</div>
          </div>
          <div class="badge-box">
            <div class="slip-title">Material Requisition Slip</div>
            <div class="tracking-pill">#${escapeHtml(trackingId)}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <strong>Department</strong>
            ${escapeHtml(indent.dept || "TIFFINS")}
          </div>
          <div class="meta-item">
            <strong>Requisition Date</strong>
            ${formatDate(indent.date)}
          </div>
          <div class="meta-item">
            <strong>Shift & Production</strong>
            ${escapeHtml(indent.shift || "MORNING")} SHIFT
          </div>
          <div class="meta-item">
            <strong>Priority Level</strong>
            ${escapeHtml(indent.priority || "NORMAL")}
          </div>
        </div>

        ${indent.remarks ? `
          <div class="notes-box">
            💬 <strong>Station Prep Notes:</strong> "${escapeHtml(indent.remarks.trim())}"
          </div>
        ` : ""}

        <div class="section-title">
          <span>Section A: Kitchen Ingredients & Raw Materials (${ingredients.length} items)</span>
          <span>Est. ₹${ingTotal.toFixed(2)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Item Description</th>
              <th style="width: 110px;">Category</th>
              <th style="width: 90px; text-align: right;">Requested</th>
              <th style="width: 75px; text-align: right;">Est Rate</th>
              <th style="width: 85px; text-align: right;">Est Total</th>
            </tr>
          </thead>
          <tbody>
            ${renderItemRows(ingredients, 0)}
          </tbody>
        </table>

        <div class="section-title" style="background: #92400e;">
          <span>Section B: Packaging, Disposables & Service Materials (${disposables.length} items)</span>
          <span>Est. ₹${dispTotal.toFixed(2)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Disposable Item Description</th>
              <th style="width: 110px;">Packaging Type</th>
              <th style="width: 90px; text-align: right;">Requested</th>
              <th style="width: 75px; text-align: right;">Est Rate</th>
              <th style="width: 85px; text-align: right;">Est Total</th>
            </tr>
          </thead>
          <tbody>
            ${renderItemRows(disposables, ingredients.length)}
          </tbody>
        </table>

        <div class="grand-total-card">
          <div>
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8;">Consolidated Requisition Valuation</div>
            <div style="font-size: 11px; color: #e2e8f0; font-weight: 500;">${items.length} Total Lines (${ingredients.length} Food + ${disposables.length} Packaging)</div>
          </div>
          <div class="grand-total-val">₹${grandTotal.toFixed(2)}</div>
        </div>

        <div class="sign-grid">
          <div class="sign-box">
            <div class="sign-box-title">1. Requisitioned By</div>
            <div class="sign-line">Chef Signature & Timestamp</div>
          </div>
          <div class="sign-box">
            <div class="sign-box-title">2. Verified & Issued By</div>
            <div class="sign-line">Central Storekeeper Signature</div>
          </div>
          <div class="sign-box">
            <div class="sign-box-title">3. Approved By</div>
            <div class="sign-line">Store Manager / In-Charge</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export default function ChefIndentDeskTab({ onIndentCreated }) {
  const { user, roles } = useAuth();
  const { stocks = [] } = useAppContext();
  const isStoreManager = roles.some(
    (r) => r.key === "store_manager" || r.key === "admin" || r.key === "director"
  );

  const [activeTab, setActiveTab] = useState("CHEF_DESK");
  const [loading, setLoading] = useState(false);
  const [subcategories, setSubcategories] = useState([]);
  const [activeSubcatCode, setActiveSubcatCode] = useState("");
  const [selectedDept, setSelectedDept] = useState("TIFFINS");
  const [shift, setShift] = useState("MORNING");
  const [priority, setPriority] = useState("NORMAL");
  const [chefNotes, setChefNotes] = useState("");
  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [draftRestoredNotice, setDraftRestoredNotice] = useState(null);

  // Disposables & Consolidated Indent State
  const [disposablesList, setDisposablesList] = useState([]);
  const [disposablesLoading, setDisposablesLoading] = useState(false);
  const [disposablesSearch, setDisposablesSearch] = useState("");
  const [showDisposablesStation, setShowDisposablesStation] = useState(false);
  const [lastPreparedIndent, setLastPreparedIndent] = useState(null);
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  const PRESET_PREP_NOTES = [
    "⚡ Morning Prep (6 AM)",
    "🔥 Urgent Shift Refill",
    "🎉 Banquet / Party Rush",
    "📦 Deliver to Kitchen Counter",
    "🥛 Fragile Dairy / Perishables",
    "🔪 Raw Cut Veggies First",
  ];

  const handleApplyPresetNote = (preset) => {
    setChefNotes((prev) => {
      const cleanPreset = preset.replace(/^[^\w\s]+\s*/, "");
      if (!prev) return cleanPreset;
      if (prev.includes(cleanPreset)) return prev;
      return `${prev} · ${cleanPreset}`;
    });
  };

  const toggleNoteDictation = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type station notes.");
      return;
    }

    if (isRecordingNote) {
      if (window._noteRecognitionInstance) {
        window._noteRecognitionInstance.stop();
      }
      setIsRecordingNote(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecordingNote(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setChefNotes((prev) => (prev ? `${prev} · ${transcript}` : transcript));
        }
      };

      recognition.onerror = (e) => {
        console.error("Speech error:", e);
        setIsRecordingNote(false);
      };

      recognition.onend = () => {
        setIsRecordingNote(false);
      };

      window._noteRecognitionInstance = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsRecordingNote(false);
    }
  };

  // Subcategory department filtering
  const [filterByDeptOnly, setFilterByDeptOnly] = useState(true);

  // Items in active subcategory template
  const [templateItems, setTemplateItems] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  // Quick Add Item on Chef Requisition Desk
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [addItemSource, setAddItemSource] = useState("CATALOG"); // 'CATALOG' | 'CUSTOM'
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogItem, setSelectedCatalogItem] = useState(null);
  const [quickItemName, setQuickItemName] = useState("");
  const [quickItemUnit, setQuickItemUnit] = useState("kg");
  const [quickItemPackSize, setQuickItemPackSize] = useState("");
  const [quickItemRate, setQuickItemRate] = useState(0);
  const [quickItemQty, setQuickItemQty] = useState("1");
  const [quickItemNotes, setQuickItemNotes] = useState("");
  const [saveToTemplatePermanently, setSaveToTemplatePermanently] = useState(true);
  const [addingItemLoading, setAddingItemLoading] = useState(false);

  // Store Queue State
  const [indentsList, setIndentsList] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [activeIndentDetail, setActiveIndentDetail] = useState(null);
  const [fulfillmentAdjustments, setFulfillmentAdjustments] = useState({});
  const [processingIndent, setProcessingIndent] = useState(false);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("STOCK_UNAVAILABLE");
  const [rejectionNote, setRejectionNote] = useState("");
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [copiedSlip, setCopiedSlip] = useState(false);

  // Telemetry State
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  // Studio State
  const [newSubcatName, setNewSubcatName] = useState("");
  const [newSubcatCode, setNewSubcatCode] = useState("");
  const [newSubcatDept, setNewSubcatDept] = useState("TIFFINS");
  const [newSubcatIcon, setNewSubcatIcon] = useState("📦");
  const [newSubcatDesc, setNewSubcatDesc] = useState("");
  const [showCreateSubcatModal, setShowCreateSubcatModal] = useState(false);
  const [addItemSubcat, setAddItemSubcat] = useState(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("kg");
  const [newItemDefaultQty, setNewItemDefaultQty] = useState("1");

  // Load subcategories
  const loadSubcategories = async () => {
    try {
      setLoading(true);
      const res = await api.indents.subcategories();
      if (res.success && res.data) {
        setSubcategories(res.data);
        if (res.data.length > 0 && !activeSubcatCode) {
          setActiveSubcatCode(res.data[0].code);
          setSelectedDept(res.data[0].department_name || "TIFFINS");
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load items when active subcategory changes
  const loadSubcatItems = async (code, targetDept = selectedDept) => {
    if (!code) return;
    try {
      const res = await api.indents.subcategoryItems(code);
      if (res.success && res.data) {
        const items = res.data.items || [];
        setTemplateItems(items);

        // Check if there is an active draft within the 2-hour TTL for this department
        const cachedDraft = loadChefDraft(targetDept);
        const draftItemsMap = cachedDraft?.items || {};

        if (cachedDraft) {
          if (cachedDraft.shift) setShift(cachedDraft.shift);
          if (cachedDraft.priority) setPriority(cachedDraft.priority);
          if (cachedDraft.remarks) setChefNotes(cachedDraft.remarks);
        }

        // Initialize line items:
        // If half-saved in draft, restore the cached quantity & selection!
        // If opening for the first time / no active draft, RESET TO ZERO (0) and unselected!
        setLineItems(
          items.map((it) => {
            const cached = draftItemsMap[it.item_name] || draftItemsMap[it.sku] || draftItemsMap[it.id];
            const hasDraft = cached !== undefined && parseFloat(cached.requestedQty || 0) > 0;
            return {
              id: it.id,
              name: it.item_name,
              sku: it.sku,
              unit: it.unit,
              pack_size: it.standard_pack_size,
              cost: parseFloat(it.live_price || it.default_cost || 0),
              in_stock: parseFloat(it.current_stock || 0),
              requestedQty: hasDraft ? parseFloat(cached.requestedQty) : 0,
              selected: hasDraft ? Boolean(cached.selected ?? true) : false,
              notes: cached?.notes || "",
            };
          })
        );

        if (cachedDraft && (Object.keys(draftItemsMap).length > 0 || (cachedDraft.remarks && cachedDraft.remarks.trim().length > 0))) {
          const minsAgo = Math.max(1, Math.round((Date.now() - cachedDraft.timestamp) / 60000));
          setDraftRestoredNotice(`Draft restored from cache (saved ${minsAgo}m ago)`);
        } else {
          setDraftRestoredNotice(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Auto-save draft cache while the chef works (debounced / on change)
  useEffect(() => {
    if (!selectedDept) return;
    const activeItems = lineItems.filter(
      (it) => (parseFloat(it.requestedQty) || 0) > 0 || (it.notes && it.notes.trim().length > 0)
    );
    const hasNotes = chefNotes && chefNotes.trim().length > 0;

    if (activeItems.length > 0 || hasNotes) {
      const existing = loadChefDraft(selectedDept) || { items: {} };
      const mergedItems = { ...(existing.items || {}) };

      lineItems.forEach((it) => {
        const qty = parseFloat(it.requestedQty) || 0;
        if (qty > 0 || (it.notes && it.notes.trim().length > 0)) {
          mergedItems[it.name] = {
            requestedQty: qty,
            selected: it.selected,
            notes: it.notes || "",
          };
        } else {
          delete mergedItems[it.name];
        }
      });

      saveChefDraft(selectedDept, {
        dept: selectedDept,
        shift,
        priority,
        remarks: chefNotes,
        items: mergedItems,
      });
    }
  }, [lineItems, chefNotes, shift, priority, selectedDept]);

  // Load store queue indents
  const loadQueue = async () => {
    try {
      setQueueLoading(true);
      const res = await api.indents.list({ limit: 50, sort: "created_at", order: "desc" });
      if (res.success && res.data) {
        setIndentsList(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setQueueLoading(false);
    }
  };

  // Load telemetry
  const loadTelemetry = async () => {
    try {
      setTelemetryLoading(true);
      const res = await api.indents.telemetry();
      if (res.success && res.data) {
        setTelemetry(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTelemetryLoading(false);
    }
  };

  // Load disposables catalog
  const loadDisposables = async () => {
    try {
      setDisposablesLoading(true);
      const res = await api.indents.getDisposables();
      if (res.success && res.data) {
        setDisposablesList(res.data);
      }
    } catch (err) {
      console.error("Failed to load disposables catalog:", err);
    } finally {
      setDisposablesLoading(false);
    }
  };

  const handleAddDisposable = (disp, addQty = 1) => {
    const qty = parseFloat(addQty) || 1;
    setLineItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.name.toLowerCase() === disp.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        const curQty = parseFloat(updated[existingIdx].requestedQty) || 0;
        const newQty = curQty + qty;
        updated[existingIdx] = {
          ...updated[existingIdx],
          requestedQty: newQty,
          selected: newQty > 0,
        };
        return updated;
      }
      const newItem = {
        id: `disp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: disp.name,
        sku: disp.item_code || "KPL-PKG",
        unit: disp.unit || "pcs",
        pack_size: `1 ${disp.unit || "pcs"}`,
        cost: parseFloat(disp.price || 0),
        in_stock: parseFloat(disp.current_stock || 0),
        requestedQty: qty,
        selected: true,
        notes: "Packaging & Disposable Material",
        category: disp.category || "Disposal",
        is_disposable: true,
      };
      return [newItem, ...prev];
    });
    setMsg({
      type: "success",
      text: `Added packaging item "${disp.name}" (${qty} ${disp.unit || "pcs"}) to active requisition! ✓`,
    });
  };

  const handleDownloadIndentExcel = async (indent) => {
    if (!indent) return;
    const targetId = indent.id || indent.indentId;
    if (!targetId) {
      setMsg({ type: "error", text: "Cannot download requisition: missing ID." });
      return;
    }
    try {
      setDownloadingExcel(true);
      const deptTag = (indent.dept || indent.department || selectedDept || "DEPT").replace(/[^a-zA-Z0-9]/g, "_");
      await api.indents.exportIndentExcel(
        targetId,
        `Kapila_Indent_Requisition_${deptTag}_#${targetId}.xlsx`
      );
      setMsg({
        type: "success",
        text: `Downloaded requisition Excel workbook for #${targetId} (${indent.dept || indent.department}) ✓`,
      });
    } catch (err) {
      setMsg({ type: "error", text: `Failed to download Excel: ${err.message}` });
    } finally {
      setDownloadingExcel(false);
    }
  };

  useEffect(() => {
    loadSubcategories();
    loadTelemetry();
    loadDisposables();
  }, []);

  useEffect(() => {
    if (activeSubcatCode) {
      loadSubcatItems(activeSubcatCode, selectedDept);
    }
  }, [activeSubcatCode]);

  useEffect(() => {
    if (activeTab === "STORE_QUEUE") {
      loadQueue();
    } else if (activeTab === "AGENTS") {
      loadTelemetry();
    }
  }, [activeTab]);

  const handleSubcatClick = (sc) => {
    setActiveSubcatCode(sc.code);
    if (sc.department_name && sc.department_name !== selectedDept) {
      setSelectedDept(sc.department_name);
    }
  };

  const handleDeptChange = (newDept) => {
    setSelectedDept(newDept);
    // When switching department, auto-select first subcategory of that department
    const deptSubcats = subcategories.filter((s) => s.department_name === newDept);
    if (deptSubcats.length > 0) {
      const isCurrentInDept = deptSubcats.some((s) => s.code === activeSubcatCode);
      if (!isCurrentInDept) {
        setActiveSubcatCode(deptSubcats[0].code);
      } else {
        loadSubcatItems(activeSubcatCode, newDept);
      }
    }
  };

  const handleQtyChange = (idx, val) => {
    const parsed = Math.max(0, parseFloat(val) || 0);
    setLineItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], requestedQty: parsed, selected: parsed > 0 };
      return next;
    });
  };

  const stepQty = (idx, delta) => {
    setLineItems((prev) => {
      const next = [...prev];
      const current = parseFloat(next[idx].requestedQty) || 0;
      const newVal = Math.max(0, parseFloat((current + delta).toFixed(2)));
      next[idx] = { ...next[idx], requestedQty: newVal, selected: newVal > 0 };
      return next;
    });
  };

  const toggleSelect = (idx) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], selected: !next[idx].selected };
      return next;
    });
  };

  // Reset all item quantities to 0, deselect them, and clear draft cache
  const handleResetAllToZero = () => {
    clearChefDraft(selectedDept);
    setLineItems((prev) =>
      prev.map((it) => ({
        ...it,
        requestedQty: 0,
        selected: false,
        notes: "",
      }))
    );
    setChefNotes("");
    setDraftRestoredNotice(null);
    setMsg({
      type: "info",
      text: "All requisition item quantities reset to zero (0). Draft cache cleared.",
    });
  };

  // Restore original template default quantities
  const handleRestoreDefaults = () => {
    if (templateItems.length > 0) {
      setLineItems(
        templateItems.map((it) => ({
          id: it.id,
          name: it.item_name,
          sku: it.sku,
          unit: it.unit,
          pack_size: it.standard_pack_size,
          cost: parseFloat(it.live_price || it.default_cost || 0),
          in_stock: parseFloat(it.current_stock || 0),
          requestedQty: parseFloat(it.default_qty || 1),
          selected: true,
          notes: "",
        }))
      );
      setMsg({ type: "info", text: "Template default quantities restored." });
    }
  };

  // Toggle select / deselect all items
  const handleToggleSelectAll = () => {
    const allSelected = lineItems.length > 0 && lineItems.every((it) => it.selected);
    setLineItems((prev) =>
      prev.map((it) => ({
        ...it,
        selected: !allSelected,
        requestedQty: !allSelected && (parseFloat(it.requestedQty) || 0) === 0 ? 1 : it.requestedQty,
      }))
    );
  };

  // Remove individual line item from active requisition
  const handleRemoveLineItem = (idx) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Selection handler for store catalog suggestion
  const handleSelectCatalogSuggestion = (stk) => {
    setSelectedCatalogItem(stk);
    setQuickItemName(stk.name);
    setQuickItemUnit((stk.unit || "kg").toLowerCase());
    setQuickItemPackSize(stk.pack_size || `1 ${(stk.unit || "kg").toLowerCase()}`);
    setQuickItemRate(parseFloat(stk.price || stk.cost_per_unit || 0));
    setCatalogSearch(stk.name);
  };

  // Add item directly in manual indent raising workflow (No leaving to Studio or Stock!)
  const handleAddQuickItem = async (e) => {
    e?.preventDefault();
    const name = quickItemName.trim();
    const qty = parseFloat(quickItemQty);

    if (!name) {
      setMsg({ type: "error", text: "Please enter an item name." });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setMsg({ type: "error", text: "Please enter a valid requested quantity greater than 0." });
      return;
    }

    try {
      setAddingItemLoading(true);
      const activeSubcat = subcategories.find((s) => s.code === activeSubcatCode);
      const sku = selectedCatalogItem?.item_code || `AD-HOC-${Date.now().toString().slice(-6)}`;
      const pack = quickItemPackSize.trim() || selectedCatalogItem?.pack_size || `1 ${quickItemUnit.toLowerCase()}`;
      const rate = parseFloat(quickItemRate) || (selectedCatalogItem ? parseFloat(selectedCatalogItem.price || selectedCatalogItem.cost_per_unit || 0) : 0);
      const inStock = selectedCatalogItem ? parseFloat(selectedCatalogItem.remaining || selectedCatalogItem.current_qty || 0) : 0;

      const newItem = {
        id: `adhoc-${Date.now()}`,
        name,
        sku,
        unit: quickItemUnit.toLowerCase(),
        pack_size: pack,
        cost: rate,
        in_stock: inStock,
        requestedQty: qty,
        selected: true,
        notes: quickItemNotes.trim(),
        isAdHoc: true,
      };

      setLineItems((prev) => {
        const existingIdx = prev.findIndex(
          (it) => it.name.toLowerCase().trim() === name.toLowerCase()
        );
        if (existingIdx >= 0) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            requestedQty: (parseFloat(updated[existingIdx].requestedQty) || 0) + qty,
            selected: true,
            notes: quickItemNotes.trim() || updated[existingIdx].notes,
          };
          return updated;
        }
        return [newItem, ...prev];
      });

      // Save to template permanently via multi-agent engine if checked
      if (saveToTemplatePermanently && activeSubcat) {
        try {
          await api.indents.createSubcategoryItem(activeSubcat.id, {
            item_name: name,
            sku,
            unit: quickItemUnit.toUpperCase(),
            standard_pack_size: pack,
            default_cost: rate,
            default_qty: qty,
            notes: quickItemNotes.trim() || undefined,
          });
          setMsg({
            type: "success",
            text: `Added "${name}" (${qty} ${quickItemUnit}) to requisition & permanently saved to "${activeSubcat.name}" template! ✓`,
          });
        } catch (err) {
          console.error("Template auto-save warning:", err);
          setMsg({
            type: "success",
            text: `Added "${name}" to requisition! (Template auto-save notice: ${err.message})`,
          });
        }
      } else {
        setMsg({
          type: "success",
          text: `Added "${name}" (${qty} ${quickItemUnit}) directly to active requisition! ✓`,
        });
      }

      // Reset quick add form fields
      setQuickItemName("");
      setQuickItemQty("1");
      setQuickItemNotes("");
      setQuickItemPackSize("");
      setQuickItemRate(0);
      setSelectedCatalogItem(null);
      setCatalogSearch("");
      setShowAddItemForm(false);
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed to add item." });
    } finally {
      setAddingItemLoading(false);
    }
  };

  // Calculate live order valuation
  const selectedItems = lineItems.filter((it) => it.selected && it.requestedQty > 0);
  const totalOrderValue = selectedItems.reduce(
    (sum, it) => sum + it.requestedQty * it.cost,
    0
  );

  // Subcategory filters & Active selection
  const deptSubcats = subcategories.filter((sc) => sc.department_name === selectedDept);
  const filteredSubcategories = filterByDeptOnly ? deptSubcats : subcategories;
  const activeSubcat = subcategories.find((sc) => sc.code === activeSubcatCode);

  // Submit Chef Indent
  const handleChefSubmit = async () => {
    if (selectedItems.length === 0) {
      setMsg({ type: "error", text: "Please select at least 1 item with requested quantity > 0." });
      return;
    }

    try {
      setSubmitting(true);
      setMsg(null);
      const payload = {
        dept: selectedDept,
        shift,
        priority,
        submittedBy: user?.name || "Executive Chef",
        remarks: chefNotes,
        items: selectedItems.map((it) => ({
          name: it.name,
          sku: it.sku,
          unit: it.unit,
          qty: it.requestedQty,
          price: it.cost,
          notes: it.notes,
        })),
      };

      const res = await api.indents.chefSubmit(payload);
      if (res.success) {
        clearChefDraft(selectedDept);
        const submittedSlip = {
          id: res.data.id || res.data.indentId,
          trackingNumber: res.data.trackingNumber,
          dept: selectedDept,
          shift,
          priority,
          remarks: payload.remarks,
          items: selectedItems,
          totalEstimatedValue: res.data.totalEstimatedValue,
          date: new Date().toISOString().slice(0, 10),
        };
        setLastPreparedIndent(submittedSlip);
        setLineItems((prev) =>
          prev.map((it) => ({
            ...it,
            requestedQty: 0,
            selected: false,
            notes: "",
          }))
        );
        setChefNotes("");
        setDraftRestoredNotice(null);
        const noteSummary = payload.remarks ? ` with station prep notes attached: "${payload.remarks}"` : "";
        setMsg({
          type: "success",
          text: `Requisition filed successfully! Tracking #${res.data.trackingNumber} (${res.data.totalItemsCount} items, est. ₹${res.data.totalEstimatedValue.toLocaleString("en-IN")})${noteSummary}`,
        });
        loadTelemetry();
        if (onIndentCreated) onIndentCreated();
      } else {
        setMsg({ type: "error", text: res.error || "Failed to submit chef requisition." });
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Server error while submitting indent." });
    } finally {
      setSubmitting(false);
    }
  };

  // Fulfillment actions
  const handleSelectIndentForDetail = (indent) => {
    setActiveIndentDetail(indent);
    const adjustments = {};
    (indent.items || []).forEach((it) => {
      adjustments[it.id] = {
        approvedQty: parseFloat(it.qty),
        issuedQty: parseFloat(it.qty),
        storeRemark: "",
      };
    });
    setFulfillmentAdjustments(adjustments);
  };

  const handleProcessFulfillment = async (action) => {
    if (!activeIndentDetail) return;
    try {
      setProcessingIndent(true);
      const fulfillments = (activeIndentDetail.items || []).map((it) => {
        const adj = fulfillmentAdjustments[it.id] || {};
        return {
          id: it.id,
          name: it.name,
          approvedQty: adj.approvedQty ?? parseFloat(it.qty),
          issuedQty: adj.issuedQty ?? parseFloat(it.qty),
        };
      });

      const res = await api.indents.processFulfillment(activeIndentDetail.id, {
        action,
        processedBy: user?.name || "Central Storekeeper",
        rejectionReason: action === "REJECT" ? rejectionReason : undefined,
        storeRemarks: action === "REJECT" ? rejectionNote : undefined,
        itemFulfillments: fulfillments,
      });

      if (res.success) {
        setMsg({
          type: "success",
          text:
            action === "ISSUE"
              ? `Issued Store Voucher #${res.issueSlipNumber} for Indent #${activeIndentDetail.id} (Dispatched: ₹${res.totalIssuedValue?.toLocaleString("en-IN")})`
              : action === "APPROVE"
              ? `Indent #${activeIndentDetail.id} approved for central dispatch.`
              : `Indent #${activeIndentDetail.id} rejected.`,
        });
        setActiveIndentDetail(null);
        setRejectionModalOpen(false);
        loadQueue();
        loadTelemetry();
      } else {
        setMsg({ type: "error", text: res.error || "Failed to process fulfillment." });
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Error processing fulfillment." });
    } finally {
      setProcessingIndent(false);
    }
  };

  const handleCreateSubcategory = async (e) => {
    e?.preventDefault();
    if (!newSubcatName.trim()) {
      setMsg({ type: "error", text: "Subcategory name is required." });
      return;
    }
    try {
      setLoading(true);
      const code = newSubcatCode.trim() || `SUB-${newSubcatName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 15)}`;
      const res = await api.indents.createSubcategory({
        code,
        name: newSubcatName.trim(),
        department_name: newSubcatDept,
        icon: newSubcatIcon || "📦",
        description: newSubcatDesc.trim() || `Specialized kitchen subcategory for ${newSubcatDept}.`,
      });
      if (res.success || res.data) {
        setMsg({ type: "success", text: `Subcategory "${newSubcatName}" created successfully! ✓` });
        setNewSubcatName("");
        setNewSubcatCode("");
        setNewSubcatDesc("");
        setShowCreateSubcatModal(false);
        await loadSubcategories();
      } else {
        setMsg({ type: "error", text: res.error || "Failed to create subcategory." });
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed to create subcategory." });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async (e) => {
    e?.preventDefault();
    if (!addItemSubcat || !newItemName.trim()) return;
    try {
      setLoading(true);
      const res = await api.indents.createSubcategoryItem(addItemSubcat.id, {
        item_name: newItemName.trim(),
        unit: newItemUnit.toLowerCase(),
        default_qty: parseFloat(newItemDefaultQty) || 1,
        standard_pack_size: `1 ${newItemUnit.toLowerCase()}`,
      });
      if (res.success || res.data) {
        setMsg({ type: "success", text: `Item "${newItemName}" added to ${addItemSubcat.name}! ✓` });
        setNewItemName("");
        setNewItemDefaultQty("1");
        setAddItemSubcat(null);
        await loadSubcategories();
        if (activeSubcatCode === addItemSubcat.code) {
          await loadSubcatItems(addItemSubcat.code);
        }
      } else {
        setMsg({ type: "error", text: res.error || "Failed to add item." });
      }
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Failed to add item." });
    } finally {
      setLoading(false);
    }
  };

  // Filtered queue indents
  const filteredIndents = indentsList.filter((ind) => {
    if (statusFilter !== "ALL" && ind.status?.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (deptFilter !== "ALL" && ind.dept !== deptFilter) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Sub-Navigation Tabs */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          background: "rgba(244, 200, 75, 0.06)",
          padding: "6px 8px",
          borderRadius: 12,
          border: "1px solid rgba(244, 200, 75, 0.18)",
        }}
      >
        <button
          onClick={() => setActiveTab("CHEF_DESK")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
            background: activeTab === "CHEF_DESK" ? COLORS.brand : "transparent",
            color: activeTab === "CHEF_DESK" ? "#18181b" : COLORS.text,
            transition: "all 0.2s",
          }}
        >
          <UtensilsCrossed size={16} />
          <span>Chef Indent Desk (Submit)</span>
        </button>

        <button
          onClick={() => setActiveTab("STORE_QUEUE")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
            background: activeTab === "STORE_QUEUE" ? COLORS.brand : "transparent",
            color: activeTab === "STORE_QUEUE" ? "#18181b" : COLORS.text,
            transition: "all 0.2s",
          }}
        >
          <Package size={16} />
          <span>Store Approvals & Issuance Queue</span>
        </button>

        <button
          onClick={() => setActiveTab("STUDIO")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
            background: activeTab === "STUDIO" ? COLORS.brand : "transparent",
            color: activeTab === "STUDIO" ? "#18181b" : COLORS.text,
            transition: "all 0.2s",
          }}
        >
          <SlidersHorizontal size={16} />
          <span>Inbuilt Indents Studio</span>
        </button>

        <button
          onClick={() => setActiveTab("AGENTS")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            fontWeight: 600,
            fontSize: "0.85rem",
            cursor: "pointer",
            background: activeTab === "AGENTS" ? COLORS.brand : "transparent",
            color: activeTab === "AGENTS" ? "#18181b" : COLORS.text,
            transition: "all 0.2s",
            marginLeft: "auto",
          }}
        >
          <Bot size={16} />
          <span>Multi-Agent Telemetry</span>
        </button>
      </div>

      {/* Flash Banner Notice & Instant Requisition Slip Downloads */}
      {msg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            background: msg.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${msg.type === "success" ? "#10b981" : "#ef4444"}`,
            color: msg.type === "success" ? "#065f46" : "#991b1b",
            fontSize: "0.88rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
              {msg.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{msg.text}</span>
            </div>
            <button
              onClick={() => {
                setMsg(null);
                setLastPreparedIndent(null);
              }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Direct Download & Print Actions after Preparing Indent */}
          {msg.type === "success" && lastPreparedIndent && (
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 4,
                paddingTop: 8,
                borderTop: "1px dashed rgba(16, 185, 129, 0.3)",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                disabled={downloadingExcel}
                onClick={() => handleDownloadIndentExcel(lastPreparedIndent)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  borderRadius: 6,
                  background: "#047857",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  transition: "all 0.15s ease",
                }}
              >
                <Download size={14} />
                <span>{downloadingExcel ? "Generating Excel..." : "Download Requisition Slip (.xlsx)"}</span>
              </button>

              <button
                type="button"
                onClick={() => printRequisitionSlip(lastPreparedIndent)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 16px",
                  borderRadius: 6,
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "1px solid #334155",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                  transition: "all 0.15s ease",
                }}
              >
                <Printer size={14} />
                <span>Print / Save PDF Requisition Slip</span>
              </button>

              <span style={{ fontSize: "0.75rem", color: "#065f46", fontWeight: 500 }}>
                ✓ Includes Kitchen Raw Materials + Packaging Disposables in one unified document
              </span>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 1: CHEF INDENT DESK (SUBMIT)
          ========================================================================= */}
      {activeTab === "CHEF_DESK" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Header & Sub-Category Selector */}
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>🍴</span>
                  <span>Chef Requisition Desk & Shift Presets</span>
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: COLORS.muted }}>
                  Select from {filteredSubcategories.length} specialized kitchen sub-categories for{" "}
                  <strong style={{ color: COLORS.text }}>{selectedDept}</strong> (or customize requisitions directly).
                </p>
              </div>

              {/* Department Selector & Scope Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setFilterByDeptOnly(true)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 16,
                      border: filterByDeptOnly ? `1.5px solid ${COLORS.brand}` : `1px solid ${COLORS.border}`,
                      background: filterByDeptOnly ? "rgba(244, 200, 75, 0.18)" : "transparent",
                      color: filterByDeptOnly ? "#92400e" : COLORS.muted,
                      fontSize: "0.75rem",
                      fontWeight: filterByDeptOnly ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {selectedDept} Only ({deptSubcats.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterByDeptOnly(false)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 16,
                      border: !filterByDeptOnly ? `1.5px solid ${COLORS.brand}` : `1px solid ${COLORS.border}`,
                      background: !filterByDeptOnly ? "rgba(244, 200, 75, 0.18)" : "transparent",
                      color: !filterByDeptOnly ? "#92400e" : COLORS.muted,
                      fontSize: "0.75rem",
                      fontWeight: !filterByDeptOnly ? 700 : 500,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    All Kitchens ({subcategories.length})
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: COLORS.muted }}>Dept:</span>
                  <select
                    value={selectedDept}
                    onChange={(e) => handleDeptChange(e.target.value)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.surface,
                      color: COLORS.text,
                      fontWeight: 700,
                      fontSize: "0.85rem",
                    }}
                  >
                    {CANONICAL_DEPTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sub-Category Chips (Filtered by Department or All) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                gap: 8,
                marginTop: 8,
              }}
            >
              {filteredSubcategories.map((sc) => {
                const isActive = activeSubcatCode === sc.code;
                return (
                  <button
                    key={sc.code}
                    onClick={() => handleSubcatClick(sc)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: isActive ? `1.5px solid ${COLORS.brand}` : `1px solid ${COLORS.border}`,
                      background: isActive ? "rgba(244, 200, 75, 0.15)" : COLORS.surface,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: "1.2rem" }}>{sc.icon || "📦"}</span>
                    <div style={{ overflow: "hidden" }}>
                      <div
                        style={{
                          fontWeight: isActive ? 700 : 500,
                          fontSize: "0.82rem",
                          color: isActive ? "#92400e" : COLORS.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {sc.name}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: COLORS.muted }}>{sc.department_name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Requisition Config Bar: Shift, Priority, Search */}
          <Card>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                alignItems: "center",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: COLORS.muted, marginBottom: 4 }}>
                  SHIFT PRODUCTION
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  <option value="MORNING">☀️ Morning Shift</option>
                  <option value="EVENING">🌆 Evening Shift</option>
                  <option value="NIGHT">🌙 Night Shift</option>
                  <option value="BANQUET">🎉 Banquet / Catering</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: COLORS.muted, marginBottom: 4 }}>
                  PRIORITY LEVEL
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    fontSize: "0.85rem",
                    fontWeight: 600,
                  }}
                >
                  <option value="NORMAL">Normal Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">⚠️ Urgent Prep</option>
                  <option value="EMERGENCY">🚨 Kitchen Emergency</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: COLORS.muted, marginBottom: 4 }}>
                  QUICK FILTER ITEMS
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search template items..."
                    style={{
                      width: "100%",
                      padding: "7px 10px 7px 28px",
                      borderRadius: 6,
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.surface,
                      fontSize: "0.85rem",
                    }}
                  />
                  <Search size={14} style={{ position: "absolute", left: 8, top: 10, color: COLORS.muted }} />
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: COLORS.muted, display: "block" }}>
                  ESTIMATED REQUISITION VALUE
                </span>
                <span style={{ fontSize: "1.3rem", fontWeight: 800, color: "#10b981" }}>
                  ₹{totalOrderValue.toLocaleString("en-IN")}
                </span>
                <span style={{ fontSize: "0.75rem", color: COLORS.muted, marginLeft: 6 }}>
                  ({selectedItems.length} items)
                </span>
              </div>
            </div>
          </Card>

          {/* Line Items Table Card */}
          <Card>
            {/* Table Action Bar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: "1.2rem" }}>{activeSubcat?.icon || "📋"}</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: COLORS.text }}>
                      {activeSubcat?.name || "Kitchen Requisition Items"}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: "rgba(244, 200, 75, 0.18)",
                        color: "#92400e",
                      }}
                    >
                      {selectedDept}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: COLORS.muted, marginTop: 2 }}>
                    {lineItems.length} items in list • {selectedItems.length} selected for requisition
                  </div>
                </div>
              </div>

              {/* Reset to Zero, Restore Defaults, and Add Item Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {draftRestoredNotice && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 10px",
                      borderRadius: 6,
                      background: "rgba(59, 130, 246, 0.12)",
                      border: "1px solid rgba(59, 130, 246, 0.28)",
                      color: "#1d4ed8",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                    }}
                  >
                    <span>💾 {draftRestoredNotice}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleResetAllToZero}
                  title="Reset all requested quantities to 0"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: "rgba(239, 68, 68, 0.08)",
                    color: "#dc2626",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <RotateCcw size={13} />
                  <span>Reset to Zero</span>
                </button>

                <button
                  type="button"
                  onClick={handleRestoreDefaults}
                  title="Restore default template prep quantities"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    color: COLORS.text,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <RefreshCw size={13} />
                  <span>Restore Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddItemForm(!showAddItemForm)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: `1.5px solid ${COLORS.brand}`,
                    background: showAddItemForm ? COLORS.brand : "rgba(244, 200, 75, 0.18)",
                    color: showAddItemForm ? "#18181b" : "#92400e",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: showAddItemForm ? "0 2px 6px rgba(244, 200, 75, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Plus size={15} />
                  <span>{showAddItemForm ? "Close Add Item" : "+ Add Item to Indent"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDisposablesStation(!showDisposablesStation)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: `1.5px solid ${showDisposablesStation ? "#6366f1" : "rgba(99, 102, 241, 0.4)"}`,
                    background: showDisposablesStation ? "#6366f1" : "rgba(99, 102, 241, 0.12)",
                    color: showDisposablesStation ? "#ffffff" : "#4338ca",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: showDisposablesStation ? "0 2px 6px rgba(99, 102, 241, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Package size={15} />
                  <span>{showDisposablesStation ? "Close Disposables" : "+ Packaging & Disposables"}</span>
                </button>
              </div>
            </div>

            {/* Inline Quick Add Item Drawer (No leaving to Studio or Stock!) */}
            {showAddItemForm && (
              <div
                style={{
                  background: "rgba(244, 200, 75, 0.05)",
                  border: `1.5px solid rgba(244, 200, 75, 0.5)`,
                  borderRadius: 10,
                  padding: "16px 18px",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "1.1rem" }}>✨</span>
                    <span style={{ fontWeight: 700, fontSize: "0.92rem", color: COLORS.text }}>
                      Add Item to Requisition ({selectedDept})
                    </span>
                    <span style={{ fontSize: "0.75rem", color: COLORS.muted }}>
                      — Single station workflow (everything is completed right here)
                    </span>
                  </div>

                  {/* Mode Toggle: Store Catalog vs Custom Ad-hoc */}
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      background: COLORS.surface,
                      padding: 3,
                      borderRadius: 6,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAddItemSource("CATALOG");
                        setSelectedCatalogItem(null);
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 4,
                        border: "none",
                        background: addItemSource === "CATALOG" ? COLORS.brand : "transparent",
                        color: addItemSource === "CATALOG" ? "#18181b" : COLORS.muted,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      📦 From Store Catalog ({stocks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddItemSource("CUSTOM");
                        setSelectedCatalogItem(null);
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 4,
                        border: "none",
                        background: addItemSource === "CUSTOM" ? COLORS.brand : "transparent",
                        color: addItemSource === "CUSTOM" ? "#18181b" : COLORS.muted,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ✏️ Custom / Special Item
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddQuickItem}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: 12,
                      alignItems: "flex-end",
                    }}
                  >
                    {addItemSource === "CATALOG" ? (
                      <div style={{ position: "relative" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: COLORS.muted,
                            marginBottom: 4,
                          }}
                        >
                          SEARCH STORE ITEM CATALOG
                        </label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={catalogSearch}
                            onChange={(e) => {
                              setCatalogSearch(e.target.value);
                              if (selectedCatalogItem && e.target.value !== selectedCatalogItem.name) {
                                setSelectedCatalogItem(null);
                              }
                            }}
                            placeholder="Type item name (e.g. Paneer, Rava, Oil)..."
                            style={{
                              width: "100%",
                              padding: "7px 10px 7px 28px",
                              borderRadius: 6,
                              border: `1px solid ${COLORS.border}`,
                              background: COLORS.surface,
                              fontSize: "0.85rem",
                            }}
                          />
                          <Search size={14} style={{ position: "absolute", left: 8, top: 10, color: COLORS.muted }} />
                        </div>

                        {/* Suggestions Dropdown */}
                        {!selectedCatalogItem && catalogSearch.trim().length > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              zIndex: 50,
                              background: COLORS.surface,
                              border: `1px solid ${COLORS.border}`,
                              borderRadius: 6,
                              boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
                              maxHeight: 180,
                              overflowY: "auto",
                              marginTop: 4,
                            }}
                          >
                            {stocks
                              .filter((s) => {
                                const q = catalogSearch.toLowerCase().trim();
                                return (
                                  (s.name && s.name.toLowerCase().includes(q)) ||
                                  (s.item_code && s.item_code.toLowerCase().includes(q)) ||
                                  (s.category && s.category.toLowerCase().includes(q))
                                );
                              })
                              .slice(0, 8)
                              .map((stk) => (
                                <div
                                  key={stk.id || stk.item_code || stk.name}
                                  onClick={() => handleSelectCatalogSuggestion(stk)}
                                  style={{
                                    padding: "8px 12px",
                                    cursor: "pointer",
                                    borderBottom: `1px solid ${COLORS.border}`,
                                    fontSize: "0.82rem",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(244, 200, 75, 0.1)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                >
                                  <div>
                                    <span style={{ fontWeight: 600, color: COLORS.text }}>{stk.name}</span>
                                    <span style={{ fontSize: "0.7rem", color: COLORS.muted, marginLeft: 6 }}>
                                      ({stk.item_code})
                                    </span>
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <span style={{ fontWeight: 700, color: "#10b981", fontSize: "0.75rem" }}>
                                      ₹{stk.price || stk.cost_per_unit || 0}/{stk.unit || "kg"}
                                    </span>
                                    <span style={{ fontSize: "0.7rem", color: COLORS.muted, marginLeft: 6 }}>
                                      Stock: {stk.remaining ?? stk.current_qty ?? 0} {stk.unit}
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: COLORS.muted,
                            marginBottom: 4,
                          }}
                        >
                          CUSTOM ITEM NAME *
                        </label>
                        <input
                          type="text"
                          value={quickItemName}
                          onChange={(e) => setQuickItemName(e.target.value)}
                          placeholder="e.g. Special Mysore Masala, Banana Leaves..."
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            borderRadius: 6,
                            border: `1px solid ${COLORS.border}`,
                            background: COLORS.surface,
                            fontSize: "0.85rem",
                            fontWeight: 600,
                          }}
                        />
                      </div>
                    )}

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: COLORS.muted,
                          marginBottom: 4,
                        }}
                      >
                        REQUESTED QTY *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0.1"
                        value={quickItemQty}
                        onChange={(e) => setQuickItemQty(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          border: `1px solid ${COLORS.border}`,
                          background: COLORS.surface,
                          fontSize: "0.85rem",
                          fontWeight: 700,
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: COLORS.muted,
                          marginBottom: 4,
                        }}
                      >
                        UNIT
                      </label>
                      <select
                        value={quickItemUnit}
                        onChange={(e) => setQuickItemUnit(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          border: `1px solid ${COLORS.border}`,
                          background: COLORS.surface,
                          fontSize: "0.85rem",
                          fontWeight: 600,
                        }}
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="ltr">ltr</option>
                        <option value="ml">ml</option>
                        <option value="nos">nos</option>
                        <option value="pkt">pkt</option>
                        <option value="box">box</option>
                        <option value="can">can</option>
                        <option value="bndl">bndl</option>
                        <option value="tin">tin</option>
                        <option value="roll">roll</option>
                        <option value="pcs">pcs</option>
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: COLORS.muted,
                          marginBottom: 4,
                        }}
                      >
                        PACK SIZE / SPECS
                      </label>
                      <input
                        type="text"
                        value={quickItemPackSize}
                        onChange={(e) => setQuickItemPackSize(e.target.value)}
                        placeholder={`e.g. 1 ${quickItemUnit}`}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          border: `1px solid ${COLORS.border}`,
                          background: COLORS.surface,
                          fontSize: "0.85rem",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: COLORS.muted,
                          marginBottom: 4,
                        }}
                      >
                        EST. RATE (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={quickItemRate}
                        onChange={(e) => setQuickItemRate(e.target.value)}
                        placeholder="0"
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: 6,
                          border: `1px solid ${COLORS.border}`,
                          background: COLORS.surface,
                          fontSize: "0.85rem",
                        }}
                      />
                    </div>
                  </div>

                  {/* Second row: station notes & multi-agent template save toggle & submit */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: `1px dashed ${COLORS.border}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <input
                        type="text"
                        value={quickItemNotes}
                        onChange={(e) => setQuickItemNotes(e.target.value)}
                        placeholder="Optional station prep note (e.g. Urgent breakfast prep)..."
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: `1px solid ${COLORS.border}`,
                          fontSize: "0.8rem",
                        }}
                      />
                    </div>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        color: COLORS.text,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={saveToTemplatePermanently}
                        onChange={(e) => setSaveToTemplatePermanently(e.target.checked)}
                      />
                      <span>
                        Also save permanently to{" "}
                        <strong style={{ color: "#b45309" }}>{activeSubcat?.name || selectedDept}</strong> template
                      </span>
                    </label>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setShowAddItemForm(false)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 6,
                          border: `1px solid ${COLORS.border}`,
                          background: COLORS.surface,
                          fontSize: "0.82rem",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <Btn
                        type="submit"
                        disabled={addingItemLoading || (!quickItemName && !selectedCatalogItem)}
                        style={{
                          padding: "6px 16px",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          background: COLORS.brand,
                          color: "#18181b",
                        }}
                      >
                        {addingItemLoading ? "Adding..." : "+ Add to Requisition"}
                      </Btn>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Packaging & Disposables Station Panel */}
            {showDisposablesStation && (
              <div
                style={{
                  background: "rgba(99, 102, 241, 0.04)",
                  border: "1.5px solid rgba(99, 102, 241, 0.4)",
                  borderRadius: 10,
                  padding: "16px 18px",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: "1.2rem" }}>📦</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: COLORS.text }}>
                        Packaging & Disposables Station — Central Stores Stock
                      </div>
                      <div style={{ fontSize: "0.74rem", color: COLORS.muted }}>
                        Unified into <strong>Section B (Packaging & Disposables)</strong> of this exact {selectedDept} requisition slip.
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDisposablesStation(false)}
                    style={{
                      background: "transparent",
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 6,
                      padding: "4px 10px",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      color: COLORS.muted,
                    }}
                  >
                    ✕ Close Station
                  </button>
                </div>

                {/* Search Disposables */}
                <div style={{ marginBottom: 12, position: "relative" }}>
                  <input
                    type="text"
                    value={disposablesSearch}
                    onChange={(e) => setDisposablesSearch(e.target.value)}
                    placeholder="Search packaging materials (e.g. 500ml container, foil, cling wrap, carry bag, meal tray)..."
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 32px",
                      borderRadius: 6,
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.surface,
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                    }}
                  />
                  <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: COLORS.muted }} />
                </div>

                {/* Disposables Items Grid */}
                {disposablesLoading ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: COLORS.muted, fontSize: "0.85rem" }}>
                    Loading Central Stores disposables catalog...
                  </div>
                ) : disposablesList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px 0", color: COLORS.muted, fontSize: "0.85rem" }}>
                    No packaging materials found.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: 10,
                      maxHeight: 320,
                      overflowY: "auto",
                      paddingRight: 4,
                    }}
                  >
                    {disposablesList
                      .filter((disp) => {
                        if (!disposablesSearch.trim()) return true;
                        const q = disposablesSearch.toLowerCase();
                        return (
                          (disp.name && disp.name.toLowerCase().includes(q)) ||
                          (disp.item_code && disp.item_code.toLowerCase().includes(q)) ||
                          (disp.category && disp.category.toLowerCase().includes(q))
                        );
                      })
                      .map((disp) => (
                        <div
                          key={disp.id || disp.name}
                          style={{
                            background: COLORS.surface,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: 8,
                            padding: "10px 12px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: 8,
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: "0.84rem", color: COLORS.text }}>
                                {disp.name}
                              </div>
                              <div style={{ fontSize: "0.7rem", color: COLORS.muted }}>
                                {disp.item_code || "KPL-PKG"} • {disp.category || "Disposal"}
                              </div>
                            </div>
                            <span
                              style={{
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                background: (disp.current_stock || 0) > 20 ? "#d1fae5" : "#fee2e2",
                                color: (disp.current_stock || 0) > 20 ? "#065f46" : "#991b1b",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Stock: {disp.current_stock || 0} {disp.unit || "pcs"}
                            </span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: COLORS.text }}>
                              ₹{disp.price || 0} / {disp.unit || "pcs"}
                            </span>
                            <div style={{ display: "flex", gap: 4 }}>
                              {[1, 5, 25, 50, 100].map((stepQty) => (
                                <button
                                  key={stepQty}
                                  type="button"
                                  onClick={() => handleAddDisposable(disp, stepQty)}
                                  style={{
                                    padding: "3px 7px",
                                    borderRadius: 4,
                                    border: "1px solid rgba(99, 102, 241, 0.4)",
                                    background: "rgba(99, 102, 241, 0.08)",
                                    color: "#4338ca",
                                    fontSize: "0.72rem",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    transition: "all 0.1s ease",
                                  }}
                                  title={`Add ${stepQty} ${disp.unit || "pcs"} to requisition`}
                                >
                                  +{stepQty}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Line Items Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}`, textAlign: "left" }}>
                    <th style={{ padding: "8px 12px", width: 40 }}>
                      <input
                        type="checkbox"
                        checked={lineItems.length > 0 && lineItems.every((it) => it.selected)}
                        onChange={handleToggleSelectAll}
                        title="Select or deselect all items"
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                    <th style={{ padding: "8px 12px" }}>Raw Material Item</th>
                    <th style={{ padding: "8px 12px" }}>Pack Size</th>
                    <th style={{ padding: "8px 12px" }}>Est. Rate</th>
                    <th style={{ padding: "8px 12px" }}>Live Stock</th>
                    <th style={{ padding: "8px 12px", width: 180 }}>Requested Qty</th>
                    <th style={{ padding: "8px 12px" }}>Subtotal</th>
                    <th style={{ padding: "8px 12px", width: 40, textAlign: "center" }}>Act</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems
                    .filter((it) => it.name.toLowerCase().includes(itemSearch.toLowerCase()))
                    .map((it, idx) => {
                      const subtotal = (parseFloat(it.requestedQty) || 0) * it.cost;
                      return (
                        <tr
                          key={it.id || idx}
                          style={{
                            borderBottom: `1px solid ${COLORS.border}`,
                            background: it.selected ? "rgba(244, 200, 75, 0.04)" : "transparent",
                          }}
                        >
                          <td style={{ padding: "10px 12px" }}>
                            <input
                              type="checkbox"
                              checked={it.selected}
                              onChange={() => toggleSelect(idx)}
                              style={{ cursor: "pointer" }}
                            />
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 600, color: COLORS.text }}>{it.name}</span>
                              {it.is_disposable || it.category === "Disposal" || it.category === "Disposables" ? (
                                <span
                                  style={{
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    background: "rgba(99, 102, 241, 0.18)",
                                    color: "#4338ca",
                                    border: "1px solid rgba(99, 102, 241, 0.3)",
                                  }}
                                >
                                  📦 PACKAGING
                                </span>
                              ) : it.isAdHoc ? (
                                <span
                                  style={{
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    background: "rgba(244, 200, 75, 0.25)",
                                    color: "#b45309",
                                  }}
                                >
                                  ADDED
                                </span>
                              ) : null}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: COLORS.muted }}>SKU: {it.sku || "N/A"}</div>
                          </td>
                          <td style={{ padding: "10px 12px", color: COLORS.muted }}>
                            {it.pack_size || "Standard"}
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                            ₹{it.cost} / {it.unit}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                background: it.in_stock > 10 ? "#d1fae5" : it.in_stock > 0 ? "#fef3c7" : "#fee2e2",
                                color: it.in_stock > 10 ? "#065f46" : it.in_stock > 0 ? "#92400e" : "#991b1b",
                              }}
                            >
                              {it.in_stock} {it.unit}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => stepQty(idx, -1)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 4,
                                  border: `1px solid ${COLORS.border}`,
                                  background: COLORS.surface,
                                  cursor: "pointer",
                                }}
                              >
                                <Minus size={12} />
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={it.requestedQty}
                                onChange={(e) => handleQtyChange(idx, e.target.value)}
                                style={{
                                  width: 70,
                                  padding: "4px 8px",
                                  borderRadius: 4,
                                  border: `1px solid ${COLORS.border}`,
                                  textAlign: "center",
                                  fontWeight: 700,
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => stepQty(idx, 1)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 4,
                                  border: `1px solid ${COLORS.border}`,
                                  background: COLORS.surface,
                                  cursor: "pointer",
                                }}
                              >
                                <Plus size={12} />
                              </button>
                              <span style={{ fontSize: "0.75rem", color: COLORS.muted }}>{it.unit}</span>
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: "#10b981" }}>
                            ₹{subtotal.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(idx)}
                              title="Remove item from current requisition"
                              style={{
                                padding: "4px 6px",
                                borderRadius: 4,
                                border: "none",
                                background: "transparent",
                                color: COLORS.muted,
                                cursor: "pointer",
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Chef Submission Footer */}
            <div
              style={{
                marginTop: 18,
                paddingTop: 18,
                borderTop: `1px solid ${COLORS.border}`,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {/* Station Prep Notes Input */}
              <div style={{ width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8rem", fontWeight: 700, color: COLORS.text, margin: 0 }}>
                    <MessageSquare size={14} color={COLORS.brand} />
                    <span>Station Prep Notes for Central Stores (Optional)</span>
                  </label>
                  {chefNotes ? (
                    <span style={{ fontSize: "0.72rem", color: COLORS.brand, fontWeight: 600 }}>
                      ● Attached to Requisition Slip
                    </span>
                  ) : null}
                </div>

                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    type="text"
                    value={chefNotes}
                    onChange={(e) => setChefNotes(e.target.value)}
                    placeholder="Optional station prep notes for Central Stores (e.g. 6 AM morning rush, deliver directly to counter, pack in plastic crates)..."
                    style={{
                      width: "100%",
                      padding: "10px 42px 10px 12px",
                      borderRadius: 8,
                      border: `1.5px solid ${chefNotes ? COLORS.brand : COLORS.border}`,
                      background: COLORS.bg,
                      color: COLORS.text,
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                      transition: "border-color 0.2s ease",
                    }}
                  />
                  <button
                    type="button"
                    onClick={toggleNoteDictation}
                    title={isRecordingNote ? "Stop Voice Dictation" : "Voice Dictate Prep Note"}
                    style={{
                      position: "absolute",
                      right: 8,
                      background: isRecordingNote ? "#ef4444" : "transparent",
                      border: "none",
                      borderRadius: "50%",
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: isRecordingNote ? "#ffffff" : COLORS.muted,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {isRecordingNote ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                </div>

                {/* Quick Tags / Chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: COLORS.muted, marginRight: 2 }}>
                    Quick Tags:
                  </span>
                  {PRESET_PREP_NOTES.map((preset) => {
                    const cleanPreset = preset.replace(/^[^\w\s]+\s*/, "");
                    const isSelected = chefNotes.includes(cleanPreset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleApplyPresetNote(preset)}
                        style={{
                          fontSize: "0.72rem",
                          padding: "3px 9px",
                          borderRadius: 12,
                          border: `1px solid ${isSelected ? COLORS.brand : COLORS.border}`,
                          background: isSelected ? "rgba(232, 168, 56, 0.15)" : "rgba(255, 255, 255, 0.03)",
                          color: isSelected ? COLORS.brand : COLORS.muted,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {preset}
                      </button>
                    );
                  })}
                  {chefNotes ? (
                    <button
                      type="button"
                      onClick={() => setChefNotes("")}
                      style={{
                        fontSize: "0.72rem",
                        padding: "3px 8px",
                        borderRadius: 12,
                        border: "1px dashed #ef4444",
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "#ef4444",
                        cursor: "pointer",
                      }}
                    >
                      ✕ Clear Note
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Action and Valuation Strip */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 10,
                  borderTop: `1px dashed ${COLORS.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: selectedItems.length > 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.04)",
                    border: `1px solid ${selectedItems.length > 0 ? "rgba(16, 185, 129, 0.3)" : COLORS.border}`,
                    fontSize: "0.82rem",
                  }}>
                    <span style={{ color: COLORS.muted }}>Selected Lines: </span>
                    <strong style={{ color: selectedItems.length > 0 ? "#10b981" : COLORS.muted }}>
                      {selectedItems.length}
                    </strong>
                  </div>

                  <div style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(232, 168, 56, 0.1)",
                    border: `1px solid rgba(232, 168, 56, 0.3)`,
                    fontSize: "0.82rem",
                  }}>
                    <span style={{ color: COLORS.muted }}>Est. Valuation: </span>
                    <strong style={{ color: COLORS.brand }}>
                      ₹{totalOrderValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <Btn
                    onClick={handleChefSubmit}
                    disabled={submitting || selectedItems.length === 0}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "11px 28px",
                      fontWeight: 800,
                      background: selectedItems.length === 0 ? "rgba(255, 255, 255, 0.08)" : COLORS.brand,
                      color: selectedItems.length === 0 ? COLORS.muted : "#18181b",
                      cursor: selectedItems.length === 0 ? "not-allowed" : "pointer",
                      boxShadow: selectedItems.length > 0 ? "0 4px 14px rgba(232, 168, 56, 0.35)" : "none",
                      fontSize: "0.92rem",
                    }}
                  >
                    <Send size={16} />
                    <span>{submitting ? "Validating Requisition..." : "Submit Requisition"}</span>
                  </Btn>
                  {selectedItems.length === 0 && (
                    <span style={{ fontSize: "0.74rem", color: "#f59e0b", fontWeight: 600 }}>
                      ⚠️ Select at least 1 item with quantity &gt; 0 to submit
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* =========================================================================
          TAB 2: STORE APPROVALS & ISSUANCE QUEUE
          ========================================================================= */}
      {activeTab === "STORE_QUEUE" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Filters Bar */}
          <Card>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: COLORS.muted, marginRight: 6 }}>
                  Status:
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="pending">Pending Review</option>
                  <option value="approved">Approved for Dispatch</option>
                  <option value="issued">Issued / Dispatched</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: COLORS.muted, marginRight: 6 }}>
                  Department:
                </span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.surface,
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="ALL">All Departments</option>
                  {CANONICAL_DEPTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <Btn
                variant="outline"
                onClick={loadQueue}
                style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}
              >
                <RefreshCw size={14} className={queueLoading ? "animate-spin" : ""} />
                <span>Refresh Queue</span>
              </Btn>
            </div>
          </Card>

          {/* Indents List Table */}
          <Card>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}`, textAlign: "left" }}>
                    <th style={{ padding: "8px 12px" }}>Indent #</th>
                    <th style={{ padding: "8px 12px" }}>Department</th>
                    <th style={{ padding: "8px 12px" }}>Date</th>
                    <th style={{ padding: "8px 12px" }}>Type</th>
                    <th style={{ padding: "8px 12px" }}>Items</th>
                    <th style={{ padding: "8px 12px" }}>Status</th>
                    <th style={{ padding: "8px 12px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndents.map((ind) => {
                    const isPending = ind.status === "pending";
                    const isApproved = ind.status === "approved";
                    const isIssued = ind.status === "issued" || ind.status === "partially_issued";

                    return (
                      <tr key={ind.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                        <td style={{ padding: "10px 12px", fontWeight: 700 }}>
                          #{ind.id}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontWeight: 600 }}>{ind.dept}</span>
                          {ind.remarks ? (
                            <div
                              style={{
                                fontSize: "0.72rem",
                                color: "#b45309",
                                marginTop: 3,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "rgba(232, 168, 56, 0.12)",
                                padding: "2px 6px",
                                borderRadius: 4,
                                border: "1px solid rgba(232, 168, 56, 0.3)",
                                maxWidth: 200,
                              }}
                              title={`Chef Station Prep Note: ${ind.remarks}`}
                            >
                              <MessageSquare size={11} style={{ flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {ind.remarks}
                              </span>
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: "10px 12px", color: COLORS.muted }}>
                          {ind.date ? new Date(ind.date).toLocaleDateString("en-IN") : "N/A"}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span
                            style={{
                              padding: "2px 6px",
                              borderRadius: 4,
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              background: ind.indent_type === "urgent" ? "#fee2e2" : "#f1f5f9",
                              color: ind.indent_type === "urgent" ? "#b91c1c" : "#475569",
                            }}
                          >
                            {(ind.indent_type || "routine").toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {ind.items ? ind.items.length : 0} items
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              background: isIssued
                                ? "#d1fae5"
                                : isApproved
                                ? "#e0f2fe"
                                : isPending
                                ? "#fef3c7"
                                : "#fee2e2",
                              color: isIssued
                                ? "#065f46"
                                : isApproved
                                ? "#0369a1"
                                : isPending
                                ? "#92400e"
                                : "#991b1b",
                            }}
                          >
                            {(ind.status || "pending").toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleDownloadIndentExcel(ind)}
                              title="Download Requisition Excel (.xlsx)"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 8px",
                                borderRadius: 5,
                                border: "1px solid #10b981",
                                background: "rgba(16, 185, 129, 0.1)",
                                color: "#059669",
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              <Download size={12} />
                              <span>Excel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => printRequisitionSlip(ind)}
                              title="Print / Save PDF Requisition Voucher"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "4px 8px",
                                borderRadius: 5,
                                border: `1px solid ${COLORS.border}`,
                                background: COLORS.surface,
                                color: COLORS.text,
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              <Printer size={12} />
                              <span>Slip</span>
                            </button>
                            <Btn
                              size="sm"
                              variant="outline"
                              onClick={() => handleSelectIndentForDetail(ind)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <Eye size={13} />
                              <span>Review & Fulfill</span>
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Indent Fulfillment Detail Modal/Drawer */}
          {activeIndentDetail && (
            <Card style={{ border: `2px solid ${COLORS.brand}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                    Store Fulfillment Review: Indent #{activeIndentDetail.id} ({activeIndentDetail.dept})
                  </h3>
                  <span style={{ fontSize: "0.8rem", color: COLORS.muted }}>
                    Target Date: {activeIndentDetail.date} · Current Status: {activeIndentDetail.status?.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadIndentExcel(activeIndentDetail)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "1px solid #10b981",
                      background: "rgba(16, 185, 129, 0.1)",
                      color: "#059669",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Download size={13} />
                    <span>Download Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => printRequisitionSlip(activeIndentDetail)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.surface,
                      color: COLORS.text,
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Printer size={13} />
                    <span>Print Slip</span>
                  </button>
                  <Btn variant="outline" size="sm" onClick={() => setActiveIndentDetail(null)}>
                    <X size={14} />
                  </Btn>
                </div>
              </div>

              {/* Chef's Station Prep Notes Display */}
              {activeIndentDetail.remarks ? (
                <div
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: "rgba(232, 168, 56, 0.12)",
                    border: "1.5px solid rgba(232, 168, 56, 0.4)",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <MessageSquare size={18} color="#e8a838" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#e8a838", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
                      Chef Station Prep Notes for Central Stores
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, lineHeight: 1.45 }}>
                      "{activeIndentDetail.remarks}"
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Line items adjustments */}
              <div style={{ overflowX: "auto", marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${COLORS.border}`, textAlign: "left" }}>
                      <th style={{ padding: "6px 8px" }}>Item</th>
                      <th style={{ padding: "6px 8px" }}>Requested</th>
                      <th style={{ padding: "6px 8px" }}>Approved Qty</th>
                      <th style={{ padding: "6px 8px" }}>Issued Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeIndentDetail.items || []).map((itm) => {
                      const adj = fulfillmentAdjustments[itm.id] || {
                        approvedQty: parseFloat(itm.qty),
                        issuedQty: parseFloat(itm.qty),
                      };
                      return (
                        <tr key={itm.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                          <td style={{ padding: "8px" }}>
                            <div style={{ fontWeight: 600 }}>{itm.name}</div>
                            <div style={{ fontSize: "0.7rem", color: COLORS.muted }}>{itm.item_code}</div>
                          </td>
                          <td style={{ padding: "8px", fontWeight: 600 }}>
                            {itm.qty} {itm.unit}
                          </td>
                          <td style={{ padding: "8px" }}>
                            <input
                              type="number"
                              step="any"
                              value={adj.approvedQty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setFulfillmentAdjustments((prev) => ({
                                  ...prev,
                                  [itm.id]: { ...prev[itm.id], approvedQty: val },
                                }));
                              }}
                              style={{
                                width: 80,
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: `1px solid ${COLORS.border}`,
                              }}
                            />
                          </td>
                          <td style={{ padding: "8px" }}>
                            <input
                              type="number"
                              step="any"
                              value={adj.issuedQty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setFulfillmentAdjustments((prev) => ({
                                  ...prev,
                                  [itm.id]: { ...prev[itm.id], issuedQty: val },
                                }));
                              }}
                              style={{
                                width: 80,
                                padding: "4px 8px",
                                borderRadius: 4,
                                border: `1px solid ${COLORS.border}`,
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <Btn
                  variant="outline"
                  onClick={() => setRejectionModalOpen(true)}
                  style={{ color: "#ef4444", borderColor: "#fca5a5" }}
                >
                  <X size={15} />
                  <span>Reject Indent</span>
                </Btn>

                {activeIndentDetail.status === "pending" && (
                  <Btn
                    onClick={() => handleProcessFulfillment("APPROVE")}
                    disabled={processingIndent}
                    style={{ background: "#3b82f6", color: "#fff" }}
                  >
                    <Check size={15} />
                    <span>Approve Indent</span>
                  </Btn>
                )}

                <Btn
                  onClick={() => handleProcessFulfillment("ISSUE")}
                  disabled={processingIndent}
                  style={{ background: "#10b981", color: "#fff", fontWeight: 700 }}
                >
                  <Package size={15} />
                  <span>Dispatch & Issue Slip</span>
                </Btn>
              </div>
            </Card>
          )}

          {/* Rejection Modal */}
          {rejectionModalOpen && (
            <Card style={{ border: "2px solid #ef4444" }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#b91c1c" }}>Reject Requisition</h3>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: 4 }}>
                  REJECTION REASON
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <option value="STOCK_UNAVAILABLE">Stock Unavailable in Central Warehouse</option>
                  <option value="BUDGET_LIMIT_EXCEEDED">Department Monthly Budget Limit Exceeded</option>
                  <option value="DUPLICATE_REQUISITION">Duplicate Requisition Filed for Shift</option>
                  <option value="INVALID_SPECIFICATIONS">Invalid Pack Size or Recipe Specification</option>
                  <option value="OTHER">Other Storekeeper Discretion</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: 4 }}>
                  STOREKEEPER NOTES
                </label>
                <input
                  type="text"
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Explain why this requisition is rejected..."
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: 6,
                    border: `1px solid ${COLORS.border}`,
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn variant="outline" onClick={() => setRejectionModalOpen(false)}>
                  Cancel
                </Btn>
                <Btn
                  onClick={() => handleProcessFulfillment("REJECT")}
                  disabled={processingIndent}
                  style={{ background: "#ef4444", color: "#fff" }}
                >
                  Confirm Rejection
                </Btn>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: INBUILT INDENTS STUDIO
          ========================================================================= */}
      {activeTab === "STUDIO" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", fontWeight: 700 }}>
                🛠️ Inbuilt Indents & Sub-Categories Studio
              </h3>
              <p style={{ margin: 0, fontSize: "0.82rem", color: COLORS.muted }}>
                Manage specialized kitchen sub-categories, provision custom items, and customize kitchen requisition templates for Hotel Kapila.
              </p>
            </div>
            <Btn
              onClick={() => setShowCreateSubcatModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.brand, color: "#18181b", fontWeight: 700 }}
            >
              <Plus size={16} />
              <span>New Sub-Category</span>
            </Btn>
          </Card>

          {/* Modal: Create New Subcategory */}
          {showCreateSubcatModal && (
            <Card style={{ border: `1.5px solid ${COLORS.brand}`, background: COLORS.surface }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                  ✨ Create Specialized Kitchen Sub-Category
                </h4>
                <button
                  onClick={() => setShowCreateSubcatModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubcategory} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: 4, color: COLORS.muted }}>
                    Subcategory Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tandoor & Starters, Bakery Specials"
                    value={newSubcatName}
                    onChange={(e) => setNewSubcatName(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: 4, color: COLORS.muted }}>
                    Canonical Department *
                  </label>
                  <select
                    value={newSubcatDept}
                    onChange={(e) => setNewSubcatDept(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: "0.85rem", boxSizing: "border-box" }}
                  >
                    {CANONICAL_DEPTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: 4, color: COLORS.muted }}>
                    Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SUB-TANDOOR (Auto-generated if empty)"
                    value={newSubcatCode}
                    onChange={(e) => setNewSubcatCode(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: 4, color: COLORS.muted }}>
                    Icon / Emoji
                  </label>
                  <input
                    type="text"
                    value={newSubcatIcon}
                    onChange={(e) => setNewSubcatIcon(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: 4, color: COLORS.muted }}>
                    Description
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of items requisitioned under this sub-category"
                    value={newSubcatDesc}
                    onChange={(e) => setNewSubcatDesc(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <Btn variant="outline" type="button" onClick={() => setShowCreateSubcatModal(false)}>
                    Cancel
                  </Btn>
                  <Btn type="submit" disabled={loading} style={{ background: COLORS.brand, color: "#18181b", fontWeight: 700 }}>
                    Create Sub-Category
                  </Btn>
                </div>
              </form>
            </Card>
          )}

          {/* Modal: Add Item to Subcategory */}
          {addItemSubcat && (
            <Card style={{ border: `1.5px solid ${COLORS.brand}`, background: COLORS.surface }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                  ➕ Add Item to &quot;{addItemSubcat.name}&quot; ({addItemSubcat.department_name})
                </h4>
                <button
                  onClick={() => setAddItemSubcat(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.muted }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateItem} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div style={{ gridColumn: "1 / 3" }}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: 4, color: COLORS.muted }}>
                    Item Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kasuri Methi, Tandoori Masala, Paneer Cubes"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: 4, color: COLORS.muted }}>
                    Unit *
                  </label>
                  <select
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: "0.85rem", boxSizing: "border-box" }}
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="l">l</option>
                    <option value="ml">ml</option>
                    <option value="pcs">pcs</option>
                    <option value="pkt">pkt</option>
                    <option value="tin">tin</option>
                    <option value="bottle">bottle</option>
                    <option value="box">box</option>
                    <option value="bundle">bundle</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: 4, color: COLORS.muted }}>
                    Default Par Qty
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={newItemDefaultQty}
                    onChange={(e) => setNewItemDefaultQty(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.text, fontSize: "0.85rem", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <Btn variant="outline" type="button" onClick={() => setAddItemSubcat(null)}>
                    Cancel
                  </Btn>
                  <Btn type="submit" disabled={loading} style={{ background: COLORS.brand, color: "#18181b", fontWeight: 700 }}>
                    Add Item
                  </Btn>
                </div>
              </form>
            </Card>
          )}

          {/* Subcategories list with item counts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {subcategories.map((sc) => (
              <Card key={sc.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.8rem" }}>{sc.icon || "📦"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sc.name}</h4>
                    <span style={{ fontSize: "0.72rem", color: COLORS.muted }}>
                      Dept: <strong style={{ color: COLORS.text }}>{sc.department_name}</strong>
                    </span>
                  </div>
                  <Btn
                    variant="outline"
                    onClick={() => {
                      setAddItemSubcat(sc);
                      setNewItemName("");
                    }}
                    style={{ fontSize: "0.72rem", padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Plus size={12} />
                    <span>Item</span>
                  </Btn>
                </div>
                <p style={{ margin: 0, fontSize: "0.78rem", color: COLORS.muted, lineHeight: 1.4 }}>
                  {sc.description || "Inbuilt kitchen requisition subcategory."}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: COLORS.brandDark }}>
                    CODE: {sc.code}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: MULTI-AGENT TELEMETRY
          ========================================================================= */}
      {activeTab === "AGENTS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Key Metrics Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            <Card>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: COLORS.muted }}>
                TOTAL SUBMITTED
              </span>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: COLORS.text, margin: "4px 0" }}>
                {telemetry?.totalIndentsSubmitted || 0}
              </div>
              <span style={{ fontSize: "0.75rem", color: COLORS.muted }}>Across 9 Hotel Departments</span>
            </Card>

            <Card>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: COLORS.muted }}>
                TOTAL FULFILLED
              </span>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#10b981", margin: "4px 0" }}>
                {telemetry?.totalIndentsIssued || 0}
              </div>
              <span style={{ fontSize: "0.75rem", color: COLORS.muted }}>
                Fulfillment Rate: {telemetry?.fulfillmentRatePct ?? '—'}%
              </span>
            </Card>

            <Card>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: COLORS.muted }}>
                REQUISITION VALUATION
              </span>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: COLORS.brandDark, margin: "4px 0" }}>
                ₹{telemetry?.totalRequisitionValue?.toLocaleString("en-IN") || 0}
              </div>
              <span style={{ fontSize: "0.75rem", color: COLORS.muted }}>
                Issued: ₹{telemetry?.totalIssuedValue?.toLocaleString("en-IN") || 0}
              </span>
            </Card>

            <Card>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: COLORS.muted }}>
                INBUILT CATALOG
              </span>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#3b82f6", margin: "4px 0" }}>
                {telemetry?.totalMasterItems ?? '—'} Items
              </div>
              <span style={{ fontSize: "0.75rem", color: COLORS.muted }}>
                {telemetry?.totalSubcategories ?? '—'} Sub-categories
              </span>
            </Card>
          </div>

          {/* Active Agents Cards */}
          <Card>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <Bot size={18} />
              <span>Multi-Agent System Health & Telemetry</span>
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(telemetry?.agents || []).map((agent) => (
                <div
                  key={agent.agentCode}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 8,
                    background: "rgba(244, 200, 75, 0.04)",
                    border: `1px solid ${COLORS.border}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{agent.agentName}</span>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: "0.82rem", color: COLORS.text }}>
                    {agent.lastAction}
                  </p>
                  <span style={{ fontSize: "0.72rem", color: COLORS.muted }}>
                    Domain Scope: {agent.domainScope}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
