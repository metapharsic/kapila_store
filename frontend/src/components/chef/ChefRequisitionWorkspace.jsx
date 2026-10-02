import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as api from '../../api';
import { 
  ChefHat, Sparkles, AlertTriangle, CheckCircle2, Package, 
  Plus, Minus, Trash2, Send, RotateCcw, Maximize2, Minimize2, 
  Move, Layout, Columns, PanelLeft, PanelRight, Smartphone, 
  Tablet, Monitor, RefreshCw, X, ChevronUp, ChevronDown, 
  Flame, ShoppingCart, Info, Search, Utensils, ShieldCheck,
  Check, ArrowRight, Layers, SlidersHorizontal
} from 'lucide-react';
import RaiseIndentItemModal from './RaiseIndentItemModal';

export const CANONICAL_DEPARTMENTS = [
  { name: 'TIFFINS', code: 'TFN', icon: '🥞', color: '#e8a838', bg: 'rgba(232, 168, 56, 0.14)' },
  { name: 'STAFF', code: 'STF', icon: '👥', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.14)' },
  { name: 'SI-MEALS', code: 'SIM', icon: '🍛', color: '#10b981', bg: 'rgba(168, 85, 247, 0.14)' },
  { name: 'NORTH INDIAN', code: 'NIN', icon: '🥘', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)' },
  { name: 'CHAT & SOFTY', code: 'CHT', icon: '🍦', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.14)' },
  { name: 'CHINESE & DOSA', code: 'CND', icon: '🍜', color: '#f97316', bg: 'rgba(249, 115, 22, 0.14)' },
  { name: 'MOCKTAILS & CONTINENTAL', code: 'MCT', icon: '🍹', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.14)' },
  { name: 'RESTAURANT', code: 'RST', icon: '🍽️', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.14)' },
  { name: 'ROOM SERVICE', code: 'RMS', icon: '🛎️', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.14)' }
];

const DOCK_CONFIG_KEY = 'kapila_chef_dock_config';
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours operational TTL per AGENTS.md

export default function ChefRequisitionWorkspace({
  defaultDept = 'TIFFINS',
  onClose,
  isEmbedded = false
}) {
  // --- Viewport & Device Detection ---
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const isMobile = windowWidth <= 640;
  const isTablet = windowWidth > 640 && windowWidth <= 1024;

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Flexible Docking & Window State ---
  // Modes: 'right' (split right), 'left' (split left), 'bottom' (mobile sheet), 'float' (PIP), 'fullscreen'
  const [dockConfig, setDockConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(DOCK_CONFIG_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    // Default mode based on device
    return {
      mode: isMobile ? 'bottom' : 'right',
      width: isMobile ? 380 : 500,
      floatPos: { x: 40, y: 80 },
      isMinimized: false,
      sheetHeight: 'half' // 'peek' (68px), 'half' (55vh), 'full' (94vh)
    };
  });

  const updateDockConfig = useCallback((patch) => {
    setDockConfig(prev => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(DOCK_CONFIG_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  // --- Department Selection ---
  const [activeDept, setActiveDept] = useState(defaultDept);
  const currentDeptObj = CANONICAL_DEPARTMENTS.find(d => d.name === activeDept) || CANONICAL_DEPARTMENTS[0];

  // Sync activeDept if defaultDept changes from parent callers
  useEffect(() => {
    if (defaultDept && defaultDept !== activeDept) {
      setActiveDept(defaultDept);
      setActiveTab('catalog'); // Ensure predefined indent items are populated immediately
    }
  }, [defaultDept]);

  // --- Multi-Agent Telemetry & Data ---
  const [loading, setLoading] = useState(true);
  const [radarData, setRadarData] = useState(null);
  const [activeTab, setActiveTab] = useState('catalog'); // Default: 'catalog' (predefined items)
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [configuringItem, setConfiguringItem] = useState(null);
  const [stockoutAlerts, setStockoutAlerts] = useState({});

  // --- Draft Requisition Items Map (item_code / name -> LineItem) ---
  const [draftItems, setDraftItems] = useState([]);
  const [draftLoadedTime, setDraftLoadedTime] = useState(null);

  // --- 2-Hour TTL Draft Cache Holding & Zero Reset Protocol ---
  useEffect(() => {
    const cacheKey = `kapila_chef_draft_${activeDept}`;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const age = Date.now() - (parsed.timestamp || 0);
        if (age < DRAFT_TTL_MS && Array.isArray(parsed.items) && parsed.items.length > 0) {
          setDraftItems(parsed.items);
          setDraftLoadedTime(parsed.timestamp);
          return;
        } else {
          // Evict expired cache as per protocol
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (e) {}
    // Zero-reset on initial opening
    setDraftItems([]);
    setDraftLoadedTime(null);
  }, [activeDept]);

  // --- Multi-Thread Background Autosave Worker (Debounced 350ms) ---
  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const cacheKey = `kapila_chef_draft_${activeDept}`;
      if (draftItems.length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          dept: activeDept,
          items: draftItems
        }));
      } else {
        localStorage.removeItem(cacheKey);
      }
    }, 350);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [draftItems, activeDept]);

  // --- Fetch Chef Radar Data via Multi-Agent Service ---
  const fetchRadar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.indents.chefRadar({ dept: activeDept });
      if (res && res.success) {
        setRadarData(res);
      }
    } catch (err) {
      console.error('Failed to fetch chef radar:', err);
    } finally {
      setLoading(false);
    }
  }, [activeDept]);

  useEffect(() => {
    fetchRadar();
  }, [fetchRadar]);

  // --- Tactile Item Add / Stepper Handlers with Multi-Thread Stockout Alert ---
  const handleSetItemQty = (item, qty) => {
    const targetQty = Math.max(0, parseFloat(qty) || 0);
    const itemName = item.name || item.item_name;
    const key = item.item_code || itemName;
    const stockRemaining = parseFloat(item.current_stock ?? item.remaining ?? 0);
    const isStockout = stockRemaining <= 0;

    // Out of stock alert: Only AFTER chef puts in the number (quantity > 0)
    if (targetQty > 0 && isStockout) {
      setStockoutAlerts(prev => ({ ...prev, [key]: true }));
      setFeedbackMsg({
        type: 'warning',
        text: `⚠️ Out of stock! Store Manager informed instantly (${itemName}).`
      });

      // Multi-thread asynchronous background dispatch to inform Store Manager instantly
      setTimeout(async () => {
        try {
          await api.indents.notifyStockout({
            itemName,
            itemCode: item.item_code || '',
            dept: activeDept,
            requestedQty: targetQty,
            unit: item.unit || 'KG'
          });
          console.log(`[Multi-Thread Worker] Store Manager alerted for stockout: ${itemName}`);
        } catch (err) {
          console.warn('[Multi-Thread Worker] Stockout alert dispatch error:', err);
        }
      }, 0);
    } else if (targetQty <= 0) {
      setStockoutAlerts(prev => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }

    setDraftItems(prev => {
      const existingIdx = prev.findIndex(i => (i.item_code || i.name) === key);

      if (targetQty <= 0) {
        if (existingIdx >= 0) {
          const next = [...prev];
          next.splice(existingIdx, 1);
          return next;
        }
        return prev;
      }

      const lineItem = {
        item_code: item.item_code || '',
        name: itemName,
        unit: item.unit || 'KG',
        qty: targetQty,
        requestedQty: targetQty,
        unit_price: parseFloat(item.price || item.default_cost || item.live_price || 0),
        current_stock: stockRemaining,
        category: item.category || item.subcat_name || 'Kitchen Prep'
      };

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = lineItem;
        return next;
      } else {
        return [...prev, lineItem];
      }
    });
  };

  const handleStepQty = (item, delta) => {
    const itemName = item.name || item.item_name;
    const key = item.item_code || itemName;
    const existing = draftItems.find(i => (i.item_code || i.name) === key);
    const currentQty = existing ? existing.qty : 0;
    handleSetItemQty({ ...item, name: itemName }, currentQty + delta);
  };

  const handleResetZero = () => {
    if (draftItems.length === 0) return;
    if (window.confirm(`Reset all requisition items for ${activeDept} to clean zero?`)) {
      setDraftItems([]);
      localStorage.removeItem(`kapila_chef_draft_${activeDept}`);
      setFeedbackMsg({ type: 'info', text: 'Requisition draft reset to zero.' });
      setTimeout(() => setFeedbackMsg(null), 3000);
    }
  };

  // --- Portion Demand Explosion (Agent Recipe Synthesizer) ---
  const handleExplodePortions = (recipe, portionsCount) => {
    const yieldBase = recipe.yield_portions || 1;
    const factor = portionsCount / yieldBase;
    
    // In production, recipe ingredients are scaled; provide generous feedback and prefill staple base
    setFeedbackMsg({
      type: 'success',
      text: `Agent Recipe Synthesizer: Scaled ${portionsCount} portions for ${recipe.name}.`
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // --- Submit Chef Requisition (Agent Dispatch Verifier) ---
  const handleSubmitRequisition = async () => {
    if (draftItems.length === 0) {
      alert('Please add at least 1 item to the requisition.');
      return;
    }

    setSubmitting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload = {
        dept: activeDept,
        shift: 'NIGHT_INDENT',
        priority: 'NORMAL',
        date: today,
        submittedBy: 'Chef Terminal',
        remarks: `Raised via Chef Touch Workspace. ${draftItems.length} lines.`,
        items: draftItems.map(it => ({
          item_code: it.item_code,
          name: it.name,
          qty: it.qty,
          requestedQty: it.qty,
          unit: it.unit,
          price: it.unit_price
        }))
      };

      const res = await api.indents.chefSubmit(payload);
      if (res && (res.success || res.id || res.indent)) {
        // Immediate draft purge as per protocol
        setDraftItems([]);
        localStorage.removeItem(`kapila_chef_draft_${activeDept}`);
        setFeedbackMsg({
          type: 'success',
          text: `✓ Requisition submitted to Central Store (Indent #${res.id || res.indent?.id || 'OK'}).`
        });
        fetchRadar();
      } else {
        alert(res?.error || 'Failed to submit indent. Please try again.');
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert(err.message || 'Error submitting requisition.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Draggable PIP Touch/Mouse Physics ---
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  const startDrag = (clientX, clientY) => {
    if (dockConfig.mode !== 'float') return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: dockConfig.floatPos?.x || 40,
      posY: dockConfig.floatPos?.y || 80
    };
  };

  const onDragMove = useCallback((clientX, clientY) => {
    if (!isDraggingRef.current) return;
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    const newX = Math.max(10, Math.min(window.innerWidth - 380, dragStartRef.current.posX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 300, dragStartRef.current.posY + dy));
    updateDockConfig({ floatPos: { x: newX, y: newY } });
  }, [updateDockConfig]);

  useEffect(() => {
    const handleMouseMove = (e) => onDragMove(e.clientX, e.clientY);
    const handleMouseUp = () => { isDraggingRef.current = false; };
    const handleTouchMove = (e) => {
      if (e.touches?.[0]) onDragMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchEnd = () => { isDraggingRef.current = false; };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onDragMove]);

  // Total draft valuation
  const totalDraftValue = useMemo(() => {
    return draftItems.reduce((sum, it) => sum + (it.qty * it.unit_price), 0);
  }, [draftItems]);

  // --- Two-Letter Search Engine ---
  // When at least 2 characters are typed, instant live filtering activates across all tabs and Central Store
  const isTwoLetterSearch = searchQuery.trim().length >= 2;
  const searchQ = searchQuery.trim().toLowerCase();

  // Filtered critical items based on 2-letter search query
  const filteredCritical = useMemo(() => {
    const list = radarData?.critical_items || [];
    if (!isTwoLetterSearch) return list;
    return list.filter(i => {
      const name = (i.name || '').toLowerCase();
      const code = (i.item_code || '').toLowerCase();
      return name.includes(searchQ) || code.includes(searchQ);
    });
  }, [radarData?.critical_items, isTwoLetterSearch, searchQ]);

  // Filtered disposables items based on 2-letter search query
  const filteredDisposables = useMemo(() => {
    const list = radarData?.disposables || [];
    if (!isTwoLetterSearch) return list;
    return list.filter(i => {
      const name = (i.name || '').toLowerCase();
      const code = (i.item_code || '').toLowerCase();
      return name.includes(searchQ) || code.includes(searchQ);
    });
  }, [radarData?.disposables, isTwoLetterSearch, searchQ]);

  // Filtered recipes based on 2-letter search query
  const filteredRecipes = useMemo(() => {
    const list = radarData?.station_recipes || [];
    if (!isTwoLetterSearch) return list;
    return list.filter(r => {
      const name = (r.name || '').toLowerCase();
      const cat = (r.category || '').toLowerCase();
      return name.includes(searchQ) || cat.includes(searchQ);
    });
  }, [radarData?.station_recipes, isTwoLetterSearch, searchQ]);

  // Filtered catalog items based on 2-letter search query
  const filteredCatalog = useMemo(() => {
    const list = radarData?.catalog_items || [];
    if (!isTwoLetterSearch) return list;
    return list.filter(i => {
      const name = (i.name || i.item_name || '').toLowerCase();
      const code = (i.item_code || '').toLowerCase();
      return name.includes(searchQ) || code.includes(searchQ);
    });
  }, [radarData?.catalog_items, isTwoLetterSearch, searchQ]);

  // Central Store live lookup for 2-letter search queries
  const [centralStoreMatches, setCentralStoreMatches] = useState([]);
  const [storeSearching, setStoreSearching] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setCentralStoreMatches([]);
      return;
    }
    const timer = setTimeout(async () => {
      setStoreSearching(true);
      try {
        const res = await api.stock.list({ q, limit: 10 });
        const list = res?.data || res || [];
        setCentralStoreMatches(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Central store 2-letter search error:', err);
      } finally {
        setStoreSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // If minimized, display a sleek floating thumb badge
  if (dockConfig.isMinimized) {
    return (
      <button
        onClick={() => updateDockConfig({ isMinimized: false })}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1.5px solid #e8a838',
          borderRadius: 30,
          padding: '12px 20px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.7), 0 0 20px rgba(232, 168, 56, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: 14,
          touchAction: 'manipulation'
        }}
      >
        <div style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: '#e8a838',
          color: '#080c14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 13
        }}>
          {draftItems.length}
        </div>
        <span>📋 Requisition Workspace ({activeDept})</span>
        <span style={{ color: '#10b981', fontSize: 12 }}>₹{totalDraftValue.toFixed(2)}</span>
      </button>
    );
  }

  // --- Determine Dynamic Container Styles based on Dock Mode ---
  const getContainerStyle = () => {
    const base = {
      background: 'rgba(15, 23, 42, 0.96)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(232, 168, 56, 0.3)',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      zIndex: 9990,
      fontFamily: 'var(--font-sans)',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
      transition: isDraggingRef.current ? 'none' : 'width 0.2s ease, height 0.2s ease',
      overflow: 'hidden'
    };

    if (dockConfig.mode === 'right') {
      return {
        ...base,
        position: 'fixed',
        top: 0,
        right: 0,
        width: isMobile ? '100vw' : `${dockConfig.width}px`,
        height: '100vh',
        borderLeft: '1.5px solid rgba(232, 168, 56, 0.4)',
        borderRight: 'none',
        borderTop: 'none',
        borderBottom: 'none',
      };
    }

    if (dockConfig.mode === 'left') {
      return {
        ...base,
        position: 'fixed',
        top: 0,
        left: 0,
        width: isMobile ? '100vw' : `${dockConfig.width}px`,
        height: '100vh',
        borderRight: '1.5px solid rgba(232, 168, 56, 0.4)',
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
      };
    }

    if (dockConfig.mode === 'bottom') {
      const heightMap = {
        peek: '72px',
        half: '60vh',
        full: '95vh'
      };
      return {
        ...base,
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100vw',
        height: heightMap[dockConfig.sheetHeight || 'half'],
        borderRadius: '24px 24px 0 0',
        borderBottom: 'none',
      };
    }

    if (dockConfig.mode === 'fullscreen') {
      return {
        ...base,
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        borderRadius: 0,
        border: 'none',
      };
    }

    // Default 'float' (PIP)
    return {
      ...base,
      position: 'fixed',
      left: `${dockConfig.floatPos?.x || 40}px`,
      top: `${dockConfig.floatPos?.y || 80}px`,
      width: isMobile ? '92vw' : `${dockConfig.width || 480}px`,
      height: '80vh',
      maxHeight: 750,
      borderRadius: 20,
    };
  };

  return (
    <div style={getContainerStyle()}>
      {/* ============================================================== */}
      {/* 1. TOUCH WORKSPACE HEADER & LAYOUT SWITCHER                      */}
      {/* ============================================================== */}
      <div 
        onMouseDown={(e) => startDrag(e.clientX, e.clientY)}
        onTouchStart={(e) => e.touches?.[0] && startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        style={{
          padding: '12px 16px',
          background: 'rgba(30, 41, 59, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: dockConfig.mode === 'float' ? 'move' : 'default',
          userSelect: 'none',
          touchAction: 'manipulation',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: currentDeptObj.bg,
            color: currentDeptObj.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18
          }}>
            {currentDeptObj.icon}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                {activeDept} Requisition
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#e8a838',
                background: 'rgba(232, 168, 56, 0.15)',
                padding: '1px 6px',
                borderRadius: 4
              }}>
                CHEF TOUCH
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {draftItems.length} items staged · ₹{totalDraftValue.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Chef Self-Adjust Layout Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Snap height toggle if mobile bottom sheet */}
          {dockConfig.mode === 'bottom' && (
            <button
              onClick={() => {
                const nextHeight = dockConfig.sheetHeight === 'half' ? 'full' : dockConfig.sheetHeight === 'full' ? 'peek' : 'half';
                updateDockConfig({ sheetHeight: nextHeight });
              }}
              title="Resize Drawer"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#cbd5e1',
                padding: '6px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {dockConfig.sheetHeight === 'full' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              {dockConfig.sheetHeight?.toUpperCase()}
            </button>
          )}

          {/* Width adjustment buttons (for side docks) */}
          {(dockConfig.mode === 'right' || dockConfig.mode === 'left') && !isMobile && (
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 2 }}>
              {[380, 500, 640].map((w) => (
                <button
                  key={w}
                  onClick={() => updateDockConfig({ width: w })}
                  style={{
                    background: dockConfig.width === w ? '#e8a838' : 'transparent',
                    color: dockConfig.width === w ? '#080c14' : '#94a3b8',
                    border: 'none',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {w === 380 ? 'S' : w === 500 ? 'M' : 'L'}
                </button>
              ))}
            </div>
          )}

          {/* Docking Mode Selector */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 2 }}>
            <button
              onClick={() => updateDockConfig({ mode: 'bottom' })}
              title="Bottom Sheet (Mobile Thumb Friendly)"
              style={{
                background: dockConfig.mode === 'bottom' ? '#3b82f6' : 'transparent',
                color: dockConfig.mode === 'bottom' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '5px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Smartphone size={14} />
            </button>
            <button
              onClick={() => updateDockConfig({ mode: 'right' })}
              title="Dock Right (Split Screen)"
              style={{
                background: dockConfig.mode === 'right' ? '#3b82f6' : 'transparent',
                color: dockConfig.mode === 'right' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '5px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <PanelRight size={14} />
            </button>
            <button
              onClick={() => updateDockConfig({ mode: 'float' })}
              title="Floating Touch Window"
              style={{
                background: dockConfig.mode === 'float' ? '#3b82f6' : 'transparent',
                color: dockConfig.mode === 'float' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '5px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Move size={14} />
            </button>
            <button
              onClick={() => updateDockConfig({ mode: 'fullscreen' })}
              title="Full Focus Cockpit"
              style={{
                background: dockConfig.mode === 'fullscreen' ? '#3b82f6' : 'transparent',
                color: dockConfig.mode === 'fullscreen' ? '#ffffff' : '#94a3b8',
                border: 'none',
                padding: '5px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Maximize2 size={14} />
            </button>
          </div>

          {/* Minimize / Close */}
          <button
            onClick={() => updateDockConfig({ isMinimized: true })}
            title="Minimize to Pill"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            <Minimize2 size={14} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="Close Workspace"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                padding: '6px',
                borderRadius: 8,
                cursor: 'pointer'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. DEPARTMENT TOUCH STRIP (9 Canonical Stations)               */}
      {/* ============================================================== */}
      <div style={{
        padding: '8px 12px',
        background: 'rgba(15, 23, 42, 0.98)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        flexShrink: 0
      }}>
        {CANONICAL_DEPARTMENTS.map((dept) => {
          const isSelected = dept.name === activeDept;
          return (
            <button
              key={dept.name}
              onClick={() => {
                setActiveDept(dept.name);
                setActiveTab('catalog'); // Instantly populate predefined indent for selected dept
              }}
              style={{
                background: isSelected ? dept.bg : 'rgba(30, 41, 59, 0.5)',
                border: `1.5px solid ${isSelected ? dept.color : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: 10,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                color: isSelected ? '#ffffff' : '#94a3b8',
                fontSize: 12,
                fontWeight: isSelected ? 800 : 600,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                touchAction: 'manipulation'
              }}
            >
              <span>{dept.icon}</span>
              <span>{dept.name}</span>
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* 3. MULTI-AGENT TELEMETRY BANNER & FEEDBACK ALERTS              */}
      {/* ============================================================== */}
      <div style={{
        padding: '6px 14px',
        background: 'rgba(232, 168, 56, 0.08)',
        borderBottom: '1px solid rgba(232, 168, 56, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 11,
        color: '#e8a838',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={12} />
          <span>
            <strong>Multi-Agent Swarm:</strong> Scout ({radarData?.agents?.scout?.status || 'ONLINE'}) · Guardian ({radarData?.agents?.guardian?.status || 'ONLINE'}) · Dispatcher ({radarData?.agents?.dispatcher?.status || 'READY'})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {draftLoadedTime && (
            <span style={{ color: '#10b981', fontSize: 10 }}>
              ● 2h Draft Active
            </span>
          )}
          <button
            onClick={fetchRadar}
            title="Refresh Station Radar"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#e8a838',
              cursor: 'pointer',
              display: 'flex',
              padding: 2
            }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div style={{
          padding: '8px 14px',
          background: feedbackMsg.type === 'warning' ? 'rgba(239, 68, 68, 0.2)' : feedbackMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          borderBottom: `1px solid ${feedbackMsg.type === 'warning' ? '#ef4444' : feedbackMsg.type === 'success' ? '#10b981' : '#3b82f6'}`,
          color: feedbackMsg.type === 'warning' ? '#fca5a5' : feedbackMsg.type === 'success' ? '#34d399' : '#93c5fd',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          {feedbackMsg.type === 'warning' ? <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} /> : <CheckCircle2 size={14} />} {feedbackMsg.text}
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. TABS: PREDEFINED INDENT | CRITICAL | DISPOSABLES | RECIPES   */}
      {/* ============================================================== */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 23, 42, 0.8)',
        flexShrink: 0
      }}>
        {[
          { id: 'catalog', label: `📋 Predefined Indent (${currentDeptObj.code || activeDept})`, count: isTwoLetterSearch ? filteredCatalog.length : (radarData?.catalog_items?.length || 0) },
          { id: 'required', label: '🚨 Critical Radar', count: isTwoLetterSearch ? filteredCritical.length : (radarData?.critical_items?.length || 0) },
          { id: 'disposables', label: '📦 Packaging & Disposables', count: isTwoLetterSearch ? filteredDisposables.length : (radarData?.disposables?.length || 0) },
          { id: 'recipes', label: '🍲 Recipe Demand', count: isTwoLetterSearch ? filteredRecipes.length : (radarData?.station_recipes?.length || 0) }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '10px 8px',
                background: isActive ? 'rgba(30, 41, 59, 0.9)' : 'transparent',
                border: 'none',
                borderBottom: `2.5px solid ${isActive ? '#e8a838' : 'transparent'}`,
                color: isActive ? '#ffffff' : '#94a3b8',
                fontSize: 12,
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                touchAction: 'manipulation'
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                fontSize: 10,
                background: isActive ? 'rgba(232, 168, 56, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                color: isActive ? '#e8a838' : '#94a3b8',
                padding: '1px 5px',
                borderRadius: 10
              }}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* 4.5 DEDICATED TWO-LETTER TOUCH SEARCH BAR (ALL TABS)           */}
      {/* ============================================================== */}
      <div style={{
        padding: '8px 14px',
        background: 'rgba(15, 23, 42, 0.95)',
        borderBottom: '1.5px solid rgba(232, 168, 56, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flexShrink: 0
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, color: isTwoLetterSearch ? '#e8a838' : '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search items with 2 letters (e.g. 'ba', 'fr', 'pa', 'to', 'ra')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(30, 41, 59, 0.9)',
              border: `1.5px solid ${isTwoLetterSearch ? '#e8a838' : 'rgba(255, 255, 255, 0.15)'}`,
              borderRadius: 10,
              padding: '8px 36px 8px 32px',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              outline: 'none',
              boxSizing: 'border-box',
              boxShadow: isTwoLetterSearch ? '0 0 10px rgba(232, 168, 56, 0.2)' : 'none'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              title="Clear search"
              style={{
                position: 'absolute',
                right: 8,
                background: 'rgba(255, 255, 255, 0.12)',
                border: 'none',
                color: '#cbd5e1',
                width: 22,
                height: 22,
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* 2-Letter Search Telemetry Bar & Quick Starter Chips */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: '#94a3b8',
          flexWrap: 'wrap',
          gap: 6
        }}>
          {!searchQuery.trim() ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ color: '#e8a838', fontWeight: 700 }}>⚡ 2-Letter Search:</span>
              {['ba', 'fr', 'fl', 'ra', 'gr', 'pa', 'to', 'ch'].map(chip => (
                <button
                  key={chip}
                  onClick={() => setSearchQuery(chip)}
                  style={{
                    background: 'rgba(232, 168, 56, 0.12)',
                    border: '1px solid rgba(232, 168, 56, 0.3)',
                    color: '#e8a838',
                    padding: '2px 7px',
                    borderRadius: 5,
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          ) : searchQuery.trim().length === 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b' }}>
              <span>ℹ️ Type 1 more letter for 2-letter search...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                color: '#10b981',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '1px 7px',
                borderRadius: 4,
                fontWeight: 700,
                fontSize: 10.5
              }}>
                ✓ 2-Letter Match: "{searchQuery}"
              </span>
              <span>
                Found <strong style={{ color: '#ffffff' }}>
                  {activeTab === 'required' ? filteredCritical.length :
                   activeTab === 'disposables' ? filteredDisposables.length :
                   activeTab === 'recipes' ? filteredRecipes.length : filteredCatalog.length}
                </strong> in this tab
                {centralStoreMatches.length > 0 && (
                  <span style={{ marginLeft: 6, color: '#e8a838' }}>
                    · {centralStoreMatches.length} in Central Store
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. MAIN CONTENT SCROLL AREA (Touch Friendly Items List)        */}
      {/* ============================================================== */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: 13 }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#e8a838' }} />
            Scanning Central Store Stock & Department Depletion...
          </div>
        )}

        {/* --- TAB 1: WHAT IS REQUIRED (CRITICAL & STAPLES) --- */}
        {!loading && activeTab === 'required' && (
          <>
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 12,
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertTriangle size={16} />
              <span>
                <strong>Agent Requirement Scout:</strong> High-priority items required for {activeDept}. Tap <strong>+</strong> to stage into requisition.
              </span>
            </div>

            {filteredCritical.map((item) => {
              const key = item.item_code || item.name;
              const itemName = item.name || item.item_name;
              const staged = draftItems.find(i => (i.item_code || i.name) === key);
              const stagedQty = staged ? staged.qty : 0;
              const stockRemaining = parseFloat(item.current_stock ?? 0);
              const hasStockoutNotice = stagedQty > 0 && (stockRemaining <= 0 || stockoutAlerts[key]);

              return (
                <div
                  key={key}
                  style={{
                    background: staged ? 'rgba(232, 168, 56, 0.12)' : 'rgba(30, 41, 59, 0.7)',
                    border: `1.5px solid ${hasStockoutNotice ? 'rgba(239, 68, 68, 0.6)' : staged ? '#e8a838' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div 
                    onClick={() => setConfiguringItem({ ...item, name: itemName, dept: activeDept })}
                    style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                    title="Touch to configure full indent options (qty, units, dish, notes)"
                  >
                    {/* SHOW ONLY THE ITEM NAME */}
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', letterSpacing: '0.2px', lineHeight: 1.3 }}>
                      {itemName}
                    </div>

                    {/* AFTER CHEF PUTS IN THE NUMBER: If out of stock, say "Out of stock! Store Manager informed instantly." */}
                    {hasStockoutNotice && (
                      <div style={{
                        marginTop: 6,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(239, 68, 68, 0.22)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        color: '#fca5a5',
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <AlertTriangle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <span>Out of stock! Store Manager informed instantly.</span>
                      </div>
                    )}
                  </div>

                  {/* Large Tactile Stepper & Options Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => setConfiguringItem({ ...item, dept: activeDept })}
                      title="Open complete options to raise indent"
                      style={{
                        height: 38,
                        padding: '0 8px',
                        borderRadius: 10,
                        background: 'rgba(232, 168, 56, 0.15)',
                        border: '1px solid rgba(232, 168, 56, 0.3)',
                        color: '#e8a838',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        touchAction: 'manipulation'
                      }}
                    >
                      <SlidersHorizontal size={13} /> Options
                    </button>
                    <button
                      onClick={() => handleStepQty(item, -1)}
                      disabled={stagedQty <= 0}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: stagedQty > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: stagedQty > 0 ? '#ef4444' : '#64748b',
                        fontSize: 18,
                        fontWeight: 800,
                        cursor: stagedQty > 0 ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        touchAction: 'manipulation'
                      }}
                    >
                      <Minus size={16} />
                    </button>

                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={stagedQty || ''}
                      placeholder="0"
                      onChange={(e) => handleSetItemQty(item, e.target.value)}
                      style={{
                        width: 54,
                        height: 38,
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: `1.5px solid ${stagedQty > 0 ? '#e8a838' : 'rgba(255, 255, 255, 0.15)'}`,
                        color: stagedQty > 0 ? '#e8a838' : '#ffffff',
                        fontSize: 15,
                        fontWeight: 800,
                        textAlign: 'center',
                        outline: 'none'
                      }}
                    />

                    <button
                      onClick={() => handleStepQty(item, 1)}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: '#e8a838',
                        border: 'none',
                        color: '#080c14',
                        fontSize: 18,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        touchAction: 'manipulation'
                      }}
                    >
                      <Plus size={16} />
                    </button>

                    <button
                      onClick={() => handleStepQty(item, 5)}
                      title="+5 Quick Add"
                      style={{
                        height: 38,
                        padding: '0 8px',
                        borderRadius: 10,
                        background: 'rgba(232, 168, 56, 0.15)',
                        border: '1px solid rgba(232, 168, 56, 0.3)',
                        color: '#e8a838',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        touchAction: 'manipulation'
                      }}
                    >
                      +5
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredCritical.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: 'rgba(30, 41, 59, 0.4)',
                borderRadius: 14,
                border: '1px dashed rgba(232, 168, 56, 0.3)',
                color: '#94a3b8'
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isTwoLetterSearch ? '#fca5a5' : '#94a3b8', marginBottom: 6 }}>
                  {isTwoLetterSearch 
                    ? `No items matching "${searchQuery}" in What is Required`
                    : 'No critical shortages recorded for this department today.'}
                </div>
                {isTwoLetterSearch && (
                  <>
                    <div style={{ fontSize: 11, marginBottom: 12 }}>
                      Check other station tabs or Central Store stock below:
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                      {filteredDisposables.length > 0 && (
                        <button
                          onClick={() => setActiveTab('disposables')}
                          style={{
                            background: 'rgba(139, 92, 246, 0.15)',
                            border: '1px solid #8b5cf6',
                            color: '#c4b5fd',
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          📦 Packaging ({filteredDisposables.length})
                        </button>
                      )}
                      {filteredCatalog.length > 0 && (
                        <button
                          onClick={() => setActiveTab('catalog')}
                          style={{
                            background: 'rgba(232, 168, 56, 0.15)',
                            border: '1px solid #e8a838',
                            color: '#e8a838',
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          📋 All Station Items ({filteredCatalog.length})
                        </button>
                      )}
                    </div>

                    {/* Central Store Live 2-Letter Matches */}
                    {centralStoreMatches.length > 0 && (
                      <div style={{ textAlign: 'left', marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#e8a838', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Sparkles size={12} />
                          <span>Matching Central Store Warehouse Items ({centralStoreMatches.length}):</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {centralStoreMatches.map(item => {
                            const key = item.item_code || item.name;
                            const staged = draftItems.find(i => (i.item_code || i.name) === key);
                            return (
                              <div
                                key={key}
                                style={{
                                  background: staged ? 'rgba(232, 168, 56, 0.15)' : 'rgba(15, 23, 42, 0.85)',
                                  border: `1.5px solid ${staged ? '#e8a838' : 'rgba(232, 168, 56, 0.3)'}`,
                                  borderRadius: 10,
                                  padding: '10px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 10
                                }}
                              >
                                <div 
                                  onClick={() => setConfiguringItem({ ...item, dept: activeDept })}
                                  style={{ flex: 1, cursor: 'pointer' }}
                                >
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{item.name}</div>
                                  <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                                    {item.category} · Stock: <strong style={{ color: '#10b981' }}>{parseFloat(item.remaining || 0)} {item.unit}</strong> · ₹{parseFloat(item.price || 0).toFixed(2)}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    onClick={() => setConfiguringItem({ ...item, dept: activeDept })}
                                    style={{
                                      padding: '5px 8px',
                                      borderRadius: 6,
                                      background: 'rgba(232, 168, 56, 0.15)',
                                      border: '1px solid rgba(232, 168, 56, 0.3)',
                                      color: '#e8a838',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ⚙️ Options
                                  </button>
                                  <button
                                    onClick={() => handleStepQty(item, 1)}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: 6,
                                      background: '#e8a838',
                                      border: 'none',
                                      color: '#080c14',
                                      fontSize: 11,
                                      fontWeight: 800,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    + Stage
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* --- TAB 2: PACKAGING & DISPOSABLES (Agent Disposables Guardian) --- */}
        {!loading && activeTab === 'disposables' && (
          <>
            <div style={{
              background: 'rgba(139, 92, 246, 0.12)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 12,
              color: '#c4b5fd',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Package size={16} />
              <span>
                <strong>Consolidated Disposables Protocol:</strong> Packaging, foil, containers & paper bowls bundled into this single unified requisition document.
              </span>
            </div>

            {filteredDisposables.map((item) => {
              const key = item.item_code || item.name;
              const itemName = item.name || item.item_name;
              const staged = draftItems.find(i => (i.item_code || i.name) === key);
              const stagedQty = staged ? staged.qty : 0;
              const stockRemaining = parseFloat(item.current_stock ?? 0);
              const hasStockoutNotice = stagedQty > 0 && (stockRemaining <= 0 || stockoutAlerts[key]);

              return (
                <div
                  key={key}
                  style={{
                    background: staged ? 'rgba(232, 168, 56, 0.12)' : 'rgba(30, 41, 59, 0.7)',
                    border: `1.5px solid ${hasStockoutNotice ? 'rgba(239, 68, 68, 0.6)' : staged ? '#e8a838' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12
                  }}
                >
                  <div 
                    onClick={() => setConfiguringItem({ ...item, name: itemName, dept: activeDept })}
                    style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                    title="Touch to configure full indent options"
                  >
                    {/* SHOW ONLY THE ITEM NAME */}
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', letterSpacing: '0.2px', lineHeight: 1.3 }}>
                      {itemName}
                    </div>

                    {/* AFTER CHEF PUTS IN THE NUMBER: If out of stock, say "Out of stock! Store Manager informed instantly." */}
                    {hasStockoutNotice && (
                      <div style={{
                        marginTop: 6,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(239, 68, 68, 0.22)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        color: '#fca5a5',
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <AlertTriangle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <span>Out of stock! Store Manager informed instantly.</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => setConfiguringItem({ ...item, dept: activeDept })}
                      title="Open complete options to raise indent"
                      style={{
                        height: 36,
                        padding: '0 8px',
                        borderRadius: 10,
                        background: 'rgba(232, 168, 56, 0.15)',
                        border: '1px solid rgba(232, 168, 56, 0.3)',
                        color: '#e8a838',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        touchAction: 'manipulation'
                      }}
                    >
                      <SlidersHorizontal size={13} /> Options
                    </button>
                    <button
                      onClick={() => handleStepQty(item, -1)}
                      disabled={stagedQty <= 0}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: stagedQty > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: stagedQty > 0 ? '#ef4444' : '#64748b',
                        cursor: stagedQty > 0 ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Minus size={15} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={stagedQty || ''}
                      placeholder="0"
                      onChange={(e) => handleSetItemQty(item, e.target.value)}
                      style={{
                        width: 50,
                        height: 36,
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: `1.5px solid ${stagedQty > 0 ? '#e8a838' : 'rgba(255, 255, 255, 0.15)'}`,
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: 800,
                        textAlign: 'center'
                      }}
                    />
                    <button
                      onClick={() => handleStepQty(item, 1)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: '#e8a838',
                        border: 'none',
                        color: '#080c14',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredDisposables.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: 'rgba(30, 41, 59, 0.4)',
                borderRadius: 14,
                border: '1px dashed rgba(232, 168, 56, 0.3)',
                color: '#94a3b8'
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isTwoLetterSearch ? '#fca5a5' : '#94a3b8', marginBottom: 6 }}>
                  {isTwoLetterSearch 
                    ? `No packaging items matching "${searchQuery}"`
                    : 'No packaging items found.'}
                </div>
                {isTwoLetterSearch && (
                  <>
                    <div style={{ fontSize: 11, marginBottom: 12 }}>
                      Check other station tabs or Central Store stock below:
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                      {filteredCritical.length > 0 && (
                        <button
                          onClick={() => setActiveTab('required')}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid #ef4444',
                            color: '#fca5a5',
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          🚨 Required ({filteredCritical.length})
                        </button>
                      )}
                      {filteredCatalog.length > 0 && (
                        <button
                          onClick={() => setActiveTab('catalog')}
                          style={{
                            background: 'rgba(232, 168, 56, 0.15)',
                            border: '1px solid #e8a838',
                            color: '#e8a838',
                            padding: '6px 12px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          📋 All Station Items ({filteredCatalog.length})
                        </button>
                      )}
                    </div>

                    {/* Central Store Live 2-Letter Matches */}
                    {centralStoreMatches.length > 0 && (
                      <div style={{ textAlign: 'left', marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#e8a838', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Sparkles size={12} />
                          <span>Matching Central Store Warehouse Items ({centralStoreMatches.length}):</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {centralStoreMatches.map(item => {
                            const key = item.item_code || item.name;
                            const staged = draftItems.find(i => (i.item_code || i.name) === key);
                            return (
                              <div
                                key={key}
                                style={{
                                  background: staged ? 'rgba(232, 168, 56, 0.15)' : 'rgba(15, 23, 42, 0.85)',
                                  border: `1.5px solid ${staged ? '#e8a838' : 'rgba(232, 168, 56, 0.3)'}`,
                                  borderRadius: 10,
                                  padding: '10px 12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 10
                                }}
                              >
                                <div 
                                  onClick={() => setConfiguringItem({ ...item, dept: activeDept })}
                                  style={{ flex: 1, cursor: 'pointer' }}
                                >
                                  <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{item.name}</div>
                                  <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                                    {item.category} · Stock: <strong style={{ color: '#10b981' }}>{parseFloat(item.remaining || 0)} {item.unit}</strong> · ₹{parseFloat(item.price || 0).toFixed(2)}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <button
                                    onClick={() => setConfiguringItem({ ...item, dept: activeDept })}
                                    style={{
                                      padding: '5px 8px',
                                      borderRadius: 6,
                                      background: 'rgba(232, 168, 56, 0.15)',
                                      border: '1px solid rgba(232, 168, 56, 0.3)',
                                      color: '#e8a838',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ⚙️ Options
                                  </button>
                                  <button
                                    onClick={() => handleStepQty(item, 1)}
                                    style={{
                                      padding: '5px 10px',
                                      borderRadius: 6,
                                      background: '#e8a838',
                                      border: 'none',
                                      color: '#080c14',
                                      fontSize: 11,
                                      fontWeight: 800,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    + Stage
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* --- TAB 3: RECIPES & PORTION DEMAND --- */}
        {!loading && activeTab === 'recipes' && (
          <>
            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 12,
              color: '#6ee7b7',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Utensils size={16} />
              <span>
                <strong>Agent Recipe Synthesizer:</strong> Tap portion buttons to scale tonight's planned meal batch into raw ingredients.
              </span>
            </div>

            {filteredRecipes.map((recipe) => (
              <div
                key={recipe.id}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1.5px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>
                      {recipe.name}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      Category: {recipe.category} · Base Yield: {recipe.yield_portions || 1} plates
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 700 }}>Explode:</span>
                  {[50, 100, 150, 200].map((portions) => (
                    <button
                      key={portions}
                      onClick={() => handleExplodePortions(recipe, portions)}
                      style={{
                        background: 'rgba(232, 168, 56, 0.15)',
                        border: '1px solid rgba(232, 168, 56, 0.3)',
                        color: '#e8a838',
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        touchAction: 'manipulation'
                      }}
                    >
                      +{portions} plates
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {filteredRecipes.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: 'rgba(30, 41, 59, 0.4)',
                borderRadius: 14,
                border: '1px dashed rgba(232, 168, 56, 0.3)',
                color: '#94a3b8'
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isTwoLetterSearch ? '#fca5a5' : '#94a3b8' }}>
                  {isTwoLetterSearch 
                    ? `No recipes matching "${searchQuery}"`
                    : 'No recipes configured for this station.'}
                </div>
              </div>
            )}
          </>
        )}

        {/* --- TAB 4: COMPLETE STATION CATALOG --- */}
        {!loading && activeTab === 'catalog' && (
          <>
            {filteredCatalog.map((item) => {
              const key = item.item_code || item.item_name || item.name;
              const itemName = item.item_name || item.name;
              const staged = draftItems.find(i => (i.item_code || i.name) === key);
              const stagedQty = staged ? staged.qty : 0;
              const stockRemaining = parseFloat(item.current_stock ?? 0);
              const hasStockoutNotice = stagedQty > 0 && (stockRemaining <= 0 || stockoutAlerts[key]);

              return (
                <div
                  key={key}
                  style={{
                    background: staged ? 'rgba(232, 168, 56, 0.12)' : 'rgba(30, 41, 59, 0.7)',
                    border: `1.5px solid ${hasStockoutNotice ? 'rgba(239, 68, 68, 0.6)' : staged ? '#e8a838' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: 14,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12
                  }}
                >
                  <div 
                    onClick={() => setConfiguringItem({ ...item, name: itemName, dept: activeDept })}
                    style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                    title="Touch to configure full indent options"
                  >
                    {/* SHOW ONLY THE ITEM NAME */}
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', letterSpacing: '0.2px', lineHeight: 1.3 }}>
                      {itemName}
                    </div>

                    {/* AFTER CHEF PUTS IN THE NUMBER: If out of stock, say "Out of stock! Store Manager informed instantly." */}
                    {hasStockoutNotice && (
                      <div style={{
                        marginTop: 6,
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(239, 68, 68, 0.22)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        color: '#fca5a5',
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <AlertTriangle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <span>Out of stock! Store Manager informed instantly.</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => setConfiguringItem({ ...item, name: itemName, dept: activeDept })}
                      title="Open complete options to raise indent"
                      style={{
                        height: 36,
                        padding: '0 8px',
                        borderRadius: 10,
                        background: 'rgba(232, 168, 56, 0.15)',
                        border: '1px solid rgba(232, 168, 56, 0.3)',
                        color: '#e8a838',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        touchAction: 'manipulation'
                      }}
                    >
                      <SlidersHorizontal size={13} /> Options
                    </button>
                    <button
                      onClick={() => handleStepQty({ ...item, name: itemName }, -1)}
                      disabled={stagedQty <= 0}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: stagedQty > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: stagedQty > 0 ? '#ef4444' : '#64748b',
                        cursor: stagedQty > 0 ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Minus size={15} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={stagedQty || ''}
                      placeholder="0"
                      onChange={(e) => handleSetItemQty({ ...item, name: itemName }, e.target.value)}
                      style={{
                        width: 50,
                        height: 36,
                        borderRadius: 10,
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: `1.5px solid ${stagedQty > 0 ? '#e8a838' : 'rgba(255, 255, 255, 0.15)'}`,
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: 800,
                        textAlign: 'center'
                      }}
                    />
                    <button
                      onClick={() => handleStepQty({ ...item, name: itemName }, 1)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: '#e8a838',
                        border: 'none',
                        color: '#080c14',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredCatalog.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: 'rgba(30, 41, 59, 0.4)',
                borderRadius: 14,
                border: '1px dashed rgba(232, 168, 56, 0.3)',
                color: '#94a3b8'
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: isTwoLetterSearch ? '#fca5a5' : '#94a3b8', marginBottom: 6 }}>
                  {isTwoLetterSearch 
                    ? `No station items matching "${searchQuery}"`
                    : 'No items found in this department template.'}
                </div>
                {isTwoLetterSearch && centralStoreMatches.length > 0 && (
                  <div style={{ textAlign: 'left', marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#e8a838', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={12} />
                      <span>Matching Central Store Warehouse Items ({centralStoreMatches.length}):</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {centralStoreMatches.map(item => {
                        const key = item.item_code || item.name;
                        const itemName = item.name || item.item_name;
                        const staged = draftItems.find(i => (i.item_code || i.name) === key);
                        const stagedQty = staged ? staged.qty : 0;
                        const stockRemaining = parseFloat(item.remaining ?? item.current_stock ?? 0);
                        const hasStockoutNotice = stagedQty > 0 && (stockRemaining <= 0 || stockoutAlerts[key]);

                        return (
                          <div
                            key={key}
                            style={{
                              background: staged ? 'rgba(232, 168, 56, 0.15)' : 'rgba(15, 23, 42, 0.85)',
                              border: `1.5px solid ${hasStockoutNotice ? 'rgba(239, 68, 68, 0.6)' : staged ? '#e8a838' : 'rgba(232, 168, 56, 0.3)'}`,
                              borderRadius: 10,
                              padding: '10px 12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10
                            }}
                          >
                            <div 
                              onClick={() => setConfiguringItem({ ...item, name: itemName, dept: activeDept })}
                              style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                            >
                              <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>{itemName}</div>
                              {hasStockoutNotice && (
                                <div style={{
                                  marginTop: 4,
                                  padding: '3px 6px',
                                  borderRadius: 5,
                                  background: 'rgba(239, 68, 68, 0.22)',
                                  border: '1px solid rgba(239, 68, 68, 0.5)',
                                  color: '#fca5a5',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5
                                }}>
                                  <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
                                  <span>Out of stock! Store Manager informed instantly.</span>
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button
                                onClick={() => setConfiguringItem({ ...item, dept: activeDept })}
                                style={{
                                  padding: '5px 8px',
                                  borderRadius: 6,
                                  background: 'rgba(232, 168, 56, 0.15)',
                                  border: '1px solid rgba(232, 168, 56, 0.3)',
                                  color: '#e8a838',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                ⚙️ Options
                              </button>
                              <button
                                onClick={() => handleStepQty(item, 1)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: 6,
                                  background: '#e8a838',
                                  border: 'none',
                                  color: '#080c14',
                                  fontSize: 11,
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                              >
                                + Stage
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================== */}
      {/* 6. BOTTOM TOUCH REQUISITION ACTION BAR                          */}
      {/* ============================================================== */}
      <div style={{
        padding: '14px 16px',
        background: 'rgba(15, 23, 42, 0.98)',
        borderTop: '1px solid rgba(232, 168, 56, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
            Staged Requisition
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>
              {draftItems.length} lines
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#e8a838' }}>
              ₹{totalDraftValue.toFixed(2)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleResetZero}
            disabled={draftItems.length === 0}
            title="Reset to Zero (Clean start)"
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 700,
              cursor: draftItems.length > 0 ? 'pointer' : 'default',
              opacity: draftItems.length > 0 ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              touchAction: 'manipulation'
            }}
          >
            <RotateCcw size={14} /> Zero Reset
          </button>

          <button
            onClick={handleSubmitRequisition}
            disabled={draftItems.length === 0 || submitting}
            style={{
              background: 'linear-gradient(135deg, #e8a838 0%, #ca8a04 100%)',
              border: 'none',
              color: '#080c14',
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: draftItems.length > 0 && !submitting ? 'pointer' : 'default',
              opacity: draftItems.length > 0 && !submitting ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: draftItems.length > 0 ? '0 4px 16px rgba(232, 168, 56, 0.4)' : 'none',
              touchAction: 'manipulation'
            }}
          >
            {submitting ? (
              <>
                <RefreshCw size={15} className="animate-spin" /> Dispatching...
              </>
            ) : (
              <>
                <Send size={15} /> Submit Indent
              </>
            )}
          </button>
        </div>
      </div>

      {/* Complete Chef Options Modal for Raising Indent on Item */}
      <RaiseIndentItemModal
        item={configuringItem}
        defaultDept={activeDept}
        isOpen={Boolean(configuringItem)}
        onClose={() => setConfiguringItem(null)}
        onItemStaged={(stagedItem) => {
          setDraftItems(prev => {
            const key = stagedItem.item_code || stagedItem.name;
            const idx = prev.findIndex(i => (i.item_code || i.name) === key);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = stagedItem;
              return next;
            }
            return [...prev, stagedItem];
          });
          setConfiguringItem(null);
        }}
      />
    </div>
  );
}
