import { useState, useEffect, useRef, useCallback } from "react";
import Section from "../../components/Section";
import { usePaginatedApi } from "../../hooks/useApi";
import * as api from "../../api";
import { getAccessToken } from "../../api/authToken";
import { COLORS } from "../../styles/colors";
import IssuanceTopSection from "./components/IssuanceTopSection";
import IssuanceHistory from "./components/IssuanceHistory";
import IndentHistoryModal from "../../components/issuance/IndentHistoryModal";
import { useBreakpoint } from "../../styles/responsive";
import BulkIssuanceScreen from "./BulkIssuanceScreen";

import { useAuth } from "../../context/AuthContext";
import { useAppContext } from "../../context/AppContext";

import { today } from "../../utils/dates";
import { calculateNormalizedQty } from "../../utils/units";
const LIMIT = 20;

export default function StoreIssuancePage() {
  const { roles } = useAuth();
  const { setCurrentScreen, setNavBlocker, stocks = [], refreshStockNames } = useAppContext();
  const { isMobile } = useBreakpoint();
  const isStoreManager = roles.some((r) => r.key === "store_manager");

  const [isBulkMode, setIsBulkMode] = useState(false);

  const [pendingIndents, setPendingIndents] = useState([]);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [issueQtys, setIssueQtys] = useState({});
  const [availableStock, setAvailableStock] = useState({});
  const [stockPrices, setStockPrices] = useState({});  // name.lower()|item_code → price from DB
  const [stockUnits, setStockUnits] = useState({});    // name.lower()|item_code → stock unit from DB
  const [confirmedItems, setConfirmedItems] = useState(new Set());
  
  const pendingIssueRef = useRef(new Map());
  const issuedRef = useRef(false);

  const [scanText, setScanText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [lastIssuedDept, setLastIssuedDept] = useState(null);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [approving, setApproving] = useState(false);

  const handleApproveIndent = async (indentId) => {
    const targetId = indentId || selectedIndent?.id;
    if (!targetId) return;
    try {
      setApproving(true);
      const res = await api.indents.processFulfillment(targetId, {
        action: "APPROVE",
        processedBy: isStoreManager ? "Store Manager" : "Central Storekeeper",
      });
      if (res.success) {
        setMsg("Indent approved successfully ✓ Ready for immediate issuance.");
        setTimeout(() => setMsg(""), 5000);
        const r = await api.indents.list({ status: "approved,partial,pending", limit: 100 });
        if (r.success) {
          setPendingIndents(r.data);
          const updated = r.data.find((i) => i.id === targetId);
          if (updated) setSelectedIndent(updated);
        }
      } else {
        setMsg("Error: " + (res.error || "Failed to approve indent."));
      }
    } catch (e) {
      setMsg("Error: " + e.message);
    } finally {
      setApproving(false);
    }
  };

  const { items, total, page, loading, error, fetch: fetchHistory } = usePaginatedApi(api.issuances.list);

  const loadIssuances = (overrides = {}) =>
    fetchHistory({ limit: LIMIT, sort: "date", order: "desc", ...overrides });

  useEffect(() => {
    loadIssuances();
    api.indents.list({ status: "approved,partial,pending", limit: 100 }).then((r) => {
      if (r.success) setPendingIndents(r.data);
    });
    refreshStockNames();
  }, []);

  const autoIssue = useCallback(async () => {
    if (issuedRef.current) return;
    if (pendingIssueRef.current.size === 0) return;

    if (selectedIndent?.status === "pending") {
      setMsg("This indent is pending approval and cannot be issued yet.");
      setTimeout(() => setMsg(""), 5000);
      return;
    }

    issuedRef.current = true;
    const issueItems = Array.from(pendingIssueRef.current.values());

    try {
      await api.issuances.create({
        indent_id: selectedIndent.id,
        dept: selectedIndent.dept,
        date: today(),
        scanned: false,
        dispatch_strategy: "LIFO",
        items: issueItems,
      });
      setLastIssuedDept(selectedIndent.dept);
      setSelectedIndent(null);
      setConfirmedItems(new Set());
      pendingIssueRef.current.clear();
      issuedRef.current = false;
      setMsg("Material issued and stock updated ✓");
      setTimeout(() => setMsg(""), 5000);
      loadIssuances({ page: 1 });
      api.indents.list({ status: "approved,partial,pending", limit: 100 }).then((r) => {
        if (r.success) setPendingIndents(r.data);
      });
    } catch (e) {
      issuedRef.current = false;
      setMsg("Error: " + e.message);
      setTimeout(() => setMsg(""), 6000);
      throw e;
    }
  }, [selectedIndent, issueQtys]);

  const handleSelectIndent = async (ind) => {
    if (pendingIssueRef.current.size > 0 && !issuedRef.current) {
      if (ind?.id && ind.id === selectedIndent?.id) return;
      const confirmed = window.confirm(
        `You have ${pendingIssueRef.current.size} confirmed item(s) not yet issued.\n\nThey will be auto-issued now before switching indents. Continue?`
      );
      if (!confirmed) return;
      try {
        await autoIssue();
      } catch (err) {
        alert("Could not auto-issue confirmed items. Please use 'Issue & Update Stock' before switching.");
        return;
      }
    }

    setSelectedIndent(ind);
    setConfirmedItems(new Set());
    pendingIssueRef.current.clear();
    issuedRef.current = false;
    if (!ind) {
      setIssueQtys({});
      setAvailableStock({});
      return;
    }

    const q = {};
    ind.items.forEach((it, i) => { q[i] = Math.max(0, parseFloat(it.qty) - parseFloat(it.issued_qty || 0)); });
    setIssueQtys(q);
    setAvailableStock({});
    setStockPrices({});
    setStockUnits({});
    
    try {
      const itemNames = ind.items.map(it => it.name);
      const itemCodes = ind.items.map(it => it.item_code).filter(Boolean);
      const res = await api.stock.available(itemNames, itemCodes);
      if (res.success) {
        // Shape: { key: { available, price, unit, name, item_code } } where key is
        // BOTH lowercased name AND item_code. We store availableStock/prices/units
        // under both keys so lookups can prefer item_code (reliable) over name.
        const avail = {};
        const prices = {};
        const units = {};
        Object.entries(res.data).forEach(([key, val]) => {
          if (typeof val === "object" && val !== null) {
            avail[key] = val.available;
            if (val.price > 0) prices[key] = val.price;
            if (val.unit) units[key] = val.unit;
          } else {
            avail[key] = val; // backwards compat
          }
        });
        setAvailableStock(avail);
        setStockPrices(prices);
        setStockUnits(units);
      }
    } catch (e) {
      console.error("Failed to check stock availability:", e);
    }
  };

  const getItemPrice = useCallback((itemName, itemCode) => {
    // Pass 0a: item_code is the reliable key — prefer it over any name matching.
    if (itemCode) {
      if (stockPrices[itemCode] > 0) return stockPrices[itemCode];
      const byCode = (stocks || []).filter(s => s.item_code === itemCode && parseFloat(s.remaining) > 0);
      const target = byCode.length ? byCode : (stocks || []).filter(s => s.item_code === itemCode);
      if (target.length) {
        const sorted = [...target].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
        if (parseFloat(sorted[0].price) > 0) return parseFloat(sorted[0].price);
      }
    }

    if (!itemName) return 0;
    const nameLower = itemName.toLowerCase().trim();

    // Pass 0: use DB price from the available endpoint (most authoritative — direct DB query)
    if (stockPrices[nameLower] > 0) return stockPrices[nameLower];

    // Pass 1: exact case-insensitive match against cached stocks context
    let matches = (stocks || []).filter(s => s.name?.toLowerCase().trim() === nameLower);

    // Pass 2: fuzzy — stock name contains query OR query contains stock name
    // Handles "Maida / मैदा" → "MAIDA", "VANILLA ICECREAM" → "VANILLA ICE CREAM", etc.
    if (matches.length === 0) {
      matches = (stocks || []).filter(s => {
        const sName = s.name?.toLowerCase().trim() || "";
        return sName.includes(nameLower) || nameLower.includes(sName);
      });
      if (matches.length > 1) {
        matches = [...matches].sort((a, b) =>
          Math.abs(a.name.length - itemName.length) - Math.abs(b.name.length - itemName.length)
        );
      }
    }

    if (matches.length === 0) return 0;
    const active = matches.filter(s => parseFloat(s.remaining) > 0);
    const target = active.length > 0 ? active : matches;
    const sorted = [...target].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
    return parseFloat(sorted[0].price) || 0;
  }, [stocks, stockPrices]);

  const getItemBaseUnit = useCallback((itemName, itemCode) => {
    // Prefer item_code — the reliable join. Uses DB unit from /available, then stocks.
    if (itemCode) {
      if (stockUnits[itemCode]) return stockUnits[itemCode];
      const byCode = (stocks || []).filter(s => s.item_code === itemCode && parseFloat(s.remaining) > 0);
      const target = byCode.length ? byCode : (stocks || []).filter(s => s.item_code === itemCode);
      if (target.length) {
        const sorted = [...target].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
        if (sorted[0].unit) return sorted[0].unit;
      }
    }

    if (!itemName) return "kg";
    const nameLower = itemName.toLowerCase().trim();
    if (stockUnits[nameLower]) return stockUnits[nameLower];
    let matches = (stocks || []).filter(s => s.name?.toLowerCase().trim() === nameLower);
    if (matches.length === 0) {
      matches = (stocks || []).filter(s => {
        const sName = s.name?.toLowerCase().trim() || "";
        return sName.includes(nameLower) || nameLower.includes(sName);
      });
      if (matches.length > 1) {
        matches = [...matches].sort((a, b) =>
          Math.abs(a.name.length - itemName.length) - Math.abs(b.name.length - itemName.length)
        );
      }
    }
    if (matches.length === 0) return "kg";
    const active = matches.filter(s => parseFloat(s.remaining) > 0);
    const target = active.length > 0 ? active : matches;
    const sorted = [...target].sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
    return sorted[0].unit || "kg";
  }, [stocks, stockUnits]);

  // Availability by item_code (reliable) with name fallback for legacy indents.
  const availFor = useCallback((item) => {
    const raw = item?.item_code && availableStock[item.item_code] != null
      ? parseFloat(availableStock[item.item_code]) || 0
      : parseFloat(availableStock[item?.name?.toLowerCase()]) || 0;
    const baseUnit = getItemBaseUnit(item?.name, item?.item_code);
    const converted = calculateNormalizedQty(raw, baseUnit, item?.unit);
    return converted !== null ? converted : raw;
  }, [availableStock, getItemBaseUnit]);


  const handleQtyChange = (idx, value) => {
    setIssueQtys(prev => ({ ...prev, [idx]: value }));
  };

  // Fix a unit mismatch inline: set the item's unit AND persist it as the stock's
  // base unit so availability/cost immediately recompute in the corrected unit.
  const handleUnitChange = async (idx, newUnit) => {
    const item = selectedIndent?.items?.[idx];
    if (!item || !item.item_code || item.item_code === "KPL-NEW") return;

    // 1. optimistic: update the indent item's unit locally
    setSelectedIndent(prev => {
      if (!prev) return prev;
      const items = prev.items.map((it, i) => (i === idx ? { ...it, unit: newUnit } : it));
      return { ...prev, items };
    });

    // 2. optimistic: update the stock-unit map (both item_code + name keys) so
    //    baseUnit resolves to newUnit → cost = qty × price, mismatch clears.
    setStockUnits(prev => ({
      ...prev,
      [item.item_code]: newUnit,
      ...(item.name ? { [item.name.toLowerCase()]: newUnit } : {}),
    }));

    try {
      const res = await api.stock.updateUnit(item.item_code, newUnit);
      if (res.success) {
        setMsg(`Unit updated to ${res.data.unit} for ${res.data.name || item.item_code} ✓`);
        if (typeof refreshStockNames === "function") refreshStockNames();
      } else {
        setMsg("Failed to update unit: " + (res.error || "unknown error"));
      }
    } catch (e) {
      setMsg("Failed to update unit: " + e.message);
    }
    setTimeout(() => setMsg(""), 3000);
  };

  const handleToggleConfirm = (idx) => {
    setConfirmedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
        pendingIssueRef.current.delete(idx);
      } else {
        next.add(idx);
        const item = selectedIndent?.items[idx];
        if (item) {
          const remainingQty = Math.max(0, parseFloat(item.qty) - parseFloat(item.issued_qty || 0));
          pendingIssueRef.current.set(idx, {
            name: item.name,
            qty: parseFloat(item.qty),
            issued: parseFloat(issueQtys[idx] ?? remainingQty),
            unit: item.unit || "kg",
            item_code: item.item_code,
            unit_price: getItemPrice(item.name, item.item_code),
          });
        }
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (!selectedIndent) return;
    const items = selectedIndent.items || [];

    // Only auto-select items with enough stock to cover the requested qty —
    // matches the row's own red "insufficient" flag. Selecting a short item
    // here would let the whole batch fail at submit on one bad line (backend
    // re-validates and rejects the entire issuance transaction).
    const isSufficient = (item, idx) => {
      const avail = availFor(item);
      const requested = parseFloat(issueQtys[idx] ?? item.qty) || 0;
      return avail >= requested;
    };

    // Check if all sufficient items are already confirmed
    let allAvailableConfirmed = true;
    for (let i = 0; i < items.length; i++) {
      if (isSufficient(items[i], i) && !confirmedItems.has(i)) {
        allAvailableConfirmed = false;
        break;
      }
    }

    if (allAvailableConfirmed) {
      // Uncheck all
      setConfirmedItems(new Set());
      pendingIssueRef.current.clear();
    } else {
      // Check all sufficient items
      setConfirmedItems((prev) => {
        const next = new Set(prev);
        items.forEach((item, idx) => {
          if (isSufficient(item, idx) && !next.has(idx)) {
            next.add(idx);
            const remainingQty = Math.max(0, parseFloat(item.qty) - parseFloat(item.issued_qty || 0));
            pendingIssueRef.current.set(idx, {
              name: item.name,
              qty: parseFloat(item.qty),
              issued: parseFloat(issueQtys[idx] ?? remainingQty),
              unit: item.unit || "kg",
              item_code: item.item_code,
              unit_price: getItemPrice(item.name, item.item_code),
            });
          }
        });
        return next;
      });
    }
  };

  const handleIssue = async () => {
    if (!selectedIndent) {
      setMsg("No indent selected — pick one from the list first.");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    if (confirmedItems.size === 0) {
      setMsg("Confirm at least one item before issuing.");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    // This is an explicit user click on the button — trust it over the
    // issuedRef guard, which exists only to stop the beforeunload/nav-blocker
    // effects from double-firing an auto-issue in the background. A real
    // button click should never be silently swallowed by that guard.
    issuedRef.current = false;
    try {
      await autoIssue();
    } catch (e) {
      // autoIssue already sets an error message; nothing more to do here.
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (pendingIssueRef.current.size === 0 || issuedRef.current) return;

      autoIssue().catch(console.error);

      const token = getAccessToken();
      const payload = JSON.stringify({
        token,
        indentId: selectedIndent?.id,
        items: Array.from(pendingIssueRef.current.values()),
      });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/store-issuance/auto-issue", blob);

      e.preventDefault();
      e.returnValue = "You have confirmed items that haven't been fully issued. Leaving now will auto-issue them.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [autoIssue, selectedIndent]);

  useEffect(() => {
    if (setNavBlocker) {
      setNavBlocker(() => async (newScreen) => {
        if (pendingIssueRef.current.size > 0 && !issuedRef.current) {
          try {
            await autoIssue();
            return true;
          } catch (e) {
             alert("Auto-issue failed. Please issue manually before leaving.");
             return false;
          }
        }
        return true;
      });
    }
    return () => {
      if (setNavBlocker) setNavBlocker(null);
    };
  }, [autoIssue, setNavBlocker]);

  // Sync unmount / screen change fallback (fires beacon to backend synchronously)
  useEffect(() => {
    return () => {
      if (pendingIssueRef.current.size > 0 && !issuedRef.current) {
        const token = getAccessToken();
        const payload = JSON.stringify({
          token,
          indentId: selectedIndent?.id,
          items: Array.from(pendingIssueRef.current.values()),
        });
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/store-issuance/auto-issue", blob);
      }
    };
  }, [selectedIndent]);

  const handleSendDayDigest = async () => {
    const dept = selectedIndent?.dept || lastIssuedDept;
    if (!dept) {
      setMsg("Issue at least one indent (or select one) before sending the day digest.");
      setTimeout(() => setMsg(""), 3000);
      return;
    }
    setSendingDigest(true);
    try {
      const res = await api.indents.closeDay({ dept, date: today() });
      setMsg(res.message || "Day digest sent ✓");
    } catch (e) {
      setMsg("Failed to send digest: " + e.message);
    } finally {
      setSendingDigest(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const handleScan = async (file) => {
    if (!file) return;
    setScanning(true);
    setScanText("Reading form with AI…");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];
        const res = await api.scan.indent(base64, file.type || "image/jpeg");
        const data = res; // api client already extracts json

        if (data.success) {
          setScanText(`Detected: ${data.data.dept} — ${data.data.items?.length || 0} items`);
          setMsg("Scanned indent loaded ✓");
          loadIssuances({ page: 1 });
          
          const targetIndentId = data.data.id;
          const foundIndent = targetIndentId ? pendingIndents.find(i => i.id === targetIndentId) : null;
          
          if (foundIndent) {
            handleSelectIndent(foundIndent);
          } else {
            // Unsaved/scanned indent from paper
            const scannedIndent = {
              id: null,
              dept: data.data.dept || "SI-MEALS",
              date: today(),
              indent_type: "routine",
              scanned: true,
              items: (data.data.items || []).map((it, idx) => ({
                id: `scanned-${idx}-${Date.now()}`,
                name: it.name,
                qty: it.qty,
                unit: it.unit || "kg",
                item_code: it.item_code || "KPL-NEW"
              }))
            };
            handleSelectIndent(scannedIndent);
          }
        } else {
          setScanText("Could not parse form. Please enter manually.");
        }
      } catch (err) {
        setScanText("Scan error: " + err.message);
      } finally {
        setScanning(false);
        setTimeout(() => setMsg(""), 3000);
        setTimeout(() => setScanText(""), 3000);
      }
    };
    reader.onerror = () => {
      setScanning(false);
      setScanText("Error reading file.");
      setTimeout(() => setScanText(""), 3000);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {isStoreManager ? (
        <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", display: "flex", flexDirection: "column" }}>
          {/* Unified Page Header */}
          <div style={{
            backgroundColor: "white",
            borderBottom: "1px solid #E2E8F0",
            padding: isMobile ? "12px 16px" : "16px 24px",
            display: "flex", alignItems: "center", gap: 16, flexShrink: 0,
          }}>
            <button
              onClick={() => setCurrentScreen("store_manager_home")}
              style={{
                background: "none",
                border: "1.5px solid #E2E8F0",
                borderRadius: "8px",
                padding: "8px 16px",
                cursor: "pointer",
                color: "#0F172A",
                fontSize: "15px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 700,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F1F5F9"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              ← Back
            </button>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 800, color: "#0F172A", fontFamily: "var(--font-display, inherit)" }}>
              Store Issuance
            </h1>
            {isStoreManager && (
              <button
                onClick={() => setIsBulkMode(!isBulkMode)}
                style={{
                  background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                  border: "1px solid #e8a838",
                  color: "#e8a838",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                ⚡ {isBulkMode ? "Standard Mode" : "Bulk Issuance Mode"}
              </button>
            )}
            {isStoreManager && (
              <button
                onClick={handleSendDayDigest}
                disabled={sendingDigest}
                style={{
                  background: "#0F172A",
                  border: "1px solid #22C55E",
                  color: "#22C55E",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: sendingDigest ? "not-allowed" : "pointer",
                  opacity: sendingDigest ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                📲 {sendingDigest ? "Sending…" : "Send Day Digest (WhatsApp)"}
              </button>
            )}
          </div>

          {/* Unified body layout */}
          {isBulkMode ? (
            <BulkIssuanceScreen onBack={() => setIsBulkMode(false)} />
          ) : (
            <div style={{
              padding: "24px",
              height: "calc(100vh - 65px)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              boxSizing: "border-box",
              overflow: "hidden"
            }}>
              <div style={selectedIndent ? { height: "90%", display: "flex", flexDirection: "column", minHeight: 0 } : { flexShrink: 0 }}>
                <IssuanceTopSection 
                  onScan={handleScan} scanning={scanning} scanText={scanText} msg={msg}
                  pendingIndents={pendingIndents} selectedIndent={selectedIndent} onSelectIndent={handleSelectIndent}
                  onIssue={handleIssue} issueQtys={issueQtys} availableStock={availableStock}
                  onQtyChange={handleQtyChange} onShowHistory={() => setIsHistoryOpen(true)}
                  confirmedItems={confirmedItems} onToggleConfirm={handleToggleConfirm} onToggleAll={handleToggleAll}
                  isMobile={isMobile} stocks={stocks} getItemPrice={getItemPrice} getItemBaseUnit={getItemBaseUnit}
                  onUnitChange={handleUnitChange}
                  onApprove={handleApproveIndent} approving={approving} isStoreManager={isStoreManager}
                />
              </div>
              
              <div style={selectedIndent ? { height: "10%", minHeight: 0 } : { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <IssuanceHistory 
                  items={items}
                  total={total}
                  page={page}
                  loading={loading}
                  error={error}
                  onPageChange={(p) => loadIssuances({ page: p })}
                  LIMIT={LIMIT}
                  defaultExpanded={selectedIndent ? false : true}
                  style={selectedIndent ? { height: "100%", overflowY: "auto" } : { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
                />
              </div>

              <IndentHistoryModal 
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
              />
            </div>
          )}
        </div>
      ) : (
        <Section title="Issue Material" sub="Storekeeper issues goods against indent requests">
          <div style={{ flexShrink: 0 }}>
            <IssuanceTopSection 
              onScan={handleScan}
              scanning={scanning}
              scanText={scanText}
              msg={msg}
              pendingIndents={pendingIndents}
              selectedIndent={selectedIndent}
              onSelectIndent={handleSelectIndent}
              onIssue={handleIssue}
              issueQtys={issueQtys}
              availableStock={availableStock}
              onQtyChange={handleQtyChange}
              onShowHistory={() => setIsHistoryOpen(true)}
              confirmedItems={confirmedItems}
              onToggleConfirm={handleToggleConfirm}
              onToggleAll={handleToggleAll}
              isMobile={isMobile}
              stocks={stocks}
              getItemPrice={getItemPrice}
              getItemBaseUnit={getItemBaseUnit}
              onUnitChange={handleUnitChange}
              onApprove={handleApproveIndent}
              approving={approving}
              isStoreManager={isStoreManager}
            />
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginTop: 16 }}>
            <IssuanceHistory
              items={items}
              total={total}
              page={page}
              loading={loading}
              error={error}
              onPageChange={(p) => loadIssuances({ page: p })}
              LIMIT={LIMIT}
              style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
            />
          </div>

          <IndentHistoryModal 
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
          />
        </Section>
      )}
    </>
  );
}
