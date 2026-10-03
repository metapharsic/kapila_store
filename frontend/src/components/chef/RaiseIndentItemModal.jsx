import React, { useState, useEffect } from 'react';
import { 
  X, Check, AlertTriangle, Send, Sparkles, Plus, Minus, 
  Package, Utensils, Clock, ShieldCheck, Tag, Info, ArrowRight,
  ClipboardList, Layers, Building2
} from 'lucide-react';
import * as api from '../../api';
import { useAppContext } from '../../context/AppContext';

export const CANONICAL_DEPARTMENTS = [
  'TIFFINS', 'STAFF', 'SI-MEALS', 'NORTH INDIAN', 
  'CHAT & SOFTY', 'CHINESE & DOSA', 'MOCKTAILS & CONTINENTAL', 
  'RESTAURANT', 'ROOM SERVICE'
];

export default function RaiseIndentItemModal({
  item,
  defaultDept = 'TIFFINS',
  isOpen,
  onClose,
  onItemStaged,
  onSuccess,
  availableDepartments,
  availableUnits,
  availablePriorities,
  availableShifts,
  quickIncrements
}) {
  const { setCurrentScreen, setIndentPreFill } = useAppContext();

  const [dbConfig, setDbConfig] = useState(null);

  useEffect(() => {
    if (!availableDepartments || !availableUnits) {
      if (api.departments && api.departments.chefConfig) {
        api.departments.chefConfig().then(res => {
          if (res?.departments) setDbConfig(res);
        }).catch(() => {});
      }
    }
  }, [availableDepartments, availableUnits]);

  const depts = (availableDepartments && availableDepartments.length > 0)
    ? availableDepartments.map(d => typeof d === 'string' ? d : d.name)
    : (dbConfig?.departments ? dbConfig.departments.map(d => d.name) : CANONICAL_DEPARTMENTS);

  const unitsList = (availableUnits && availableUnits.length > 0)
    ? availableUnits
    : (dbConfig?.units || ['KG', 'GM', 'LTR', 'ML', 'PCS', 'PACK', 'BOTTLE', 'BOX', 'TIN', 'BUNDLE', 'CAN']);

  const prioritiesList = (availablePriorities && availablePriorities.length > 0)
    ? availablePriorities
    : (dbConfig?.priorities || [
        { value: 'NORMAL', label: 'Routine (Standard)', color: '#10b981' },
        { value: 'URGENT', label: 'Urgent (Morning Prep)', color: '#f59e0b' },
        { value: 'EMERGENCY', label: 'Emergency Shortage', color: '#ef4444' }
      ]);

  const shiftsList = (availableShifts && availableShifts.length > 0)
    ? availableShifts
    : (dbConfig?.shifts || [
        { value: 'NIGHT_INDENT', label: 'Night Replenishment' },
        { value: 'MORNING', label: 'Morning 6 AM Prep' },
        { value: 'EVENING', label: 'Evening 4 PM Service' }
      ]);

  const incrementsList = (quickIncrements && quickIncrements.length > 0)
    ? quickIncrements
    : (dbConfig?.quickIncrements || [1, 5, 10, 25, 50, 100]);

  const [dept, setDept] = useState(defaultDept);
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState(item?.unit || 'KG');
  const [priority, setPriority] = useState('NORMAL'); // 'NORMAL' | 'URGENT' | 'EMERGENCY'
  const [shift, setShift] = useState('NIGHT_INDENT'); // 'MORNING' | 'NIGHT_INDENT'
  const [dishLink, setDishLink] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (item) {
      setDept(item.dept || defaultDept || 'TIFFINS');
      setQty(String(item.suggested_qty || item.default_qty || item.qty || '1'));
      setUnit(item.unit || 'KG');
      setPriority(item.priority || 'NORMAL');
      setNotes(item.notes || '');
      setDishLink(item.dishLink || '');
      setSuccessMsg('');
      setErrorMsg('');
    }
  }, [item, defaultDept]);

  if (!isOpen || !item) return null;

  const currentStock = parseFloat(item.current_stock ?? item.remaining ?? 0);
  const unitPrice = parseFloat(item.price || item.default_cost || item.live_price || 0);
  const parsedQty = parseFloat(qty) || 0;
  const estimatedTotal = parsedQty * unitPrice;

  // Tactile increment helper
  const handleStep = (delta) => {
    const next = Math.max(0, parseFloat((parsedQty + delta).toFixed(2)));
    setQty(String(next));
  };

  // Stage item into the active 2-hour TTL cache
  const handleStageToRequisition = () => {
    if (parsedQty <= 0) {
      setErrorMsg('Please enter a quantity greater than zero.');
      return;
    }

    const cacheKey = `kapila_chef_draft_${dept}`;
    try {
      let existingItems = [];
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.items)) existingItems = parsed.items;
      }

      const key = item.item_code || item.name;
      const idx = existingItems.findIndex(i => (i.item_code || i.name) === key);

      const stagedItem = {
        item_code: item.item_code || '',
        name: item.name,
        unit: unit,
        qty: parsedQty,
        requestedQty: parsedQty,
        unit_price: unitPrice,
        priority,
        shift,
        notes: notes.trim(),
        dishLink: dishLink.trim(),
        current_stock: currentStock,
        category: item.category || 'Kitchen Prep'
      };

      if (idx >= 0) {
        existingItems[idx] = stagedItem;
      } else {
        existingItems.push(stagedItem);
      }

      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        dept,
        items: existingItems
      }));

      // Multi-thread background dispatch to Store Manager if item is out of stock
      if (currentStock <= 0) {
        setTimeout(async () => {
          try {
            await api.indents.notifyStockout({
              itemName: item.name,
              itemCode: item.item_code || '',
              dept,
              requestedQty: parsedQty,
              unit
            });
            console.log(`[Multi-Thread Worker] Store Manager notified for stockout: ${item.name}`);
          } catch (e) {
            console.warn('[Multi-Thread Worker] Stockout alert dispatch error:', e);
          }
        }, 0);
      }

      if (onItemStaged) {
        onItemStaged(stagedItem, dept);
      }

      setSuccessMsg(`✓ Added ${parsedQty} ${unit} ${item.name} to ${dept} requisition. ${currentStock <= 0 ? '(Out of stock — Store Manager informed instantly!)' : ''}`);
      setTimeout(() => {
        onClose();
      }, 1100);
    } catch (e) {
      setErrorMsg('Failed to stage item to cache.');
    }
  };

  // Direct instant indent dispatch to store
  const handleDirectSubmit = async () => {
    if (parsedQty <= 0) {
      setErrorMsg('Please enter a quantity greater than zero.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload = {
        dept,
        shift,
        priority,
        date: today,
        submittedBy: 'Chef Item Action',
        remarks: notes ? `Chef Item Request: ${notes}` : `Direct item indent raised for ${item.name}`,
        items: [
          {
            item_code: item.item_code || '',
            name: item.name,
            qty: parsedQty,
            requestedQty: parsedQty,
            unit,
            price: unitPrice
          }
        ]
      };

      const res = await api.indents.chefSubmit(payload);
      if (res && (res.success || res.id || res.data?.id)) {
        if (currentStock <= 0) {
          setTimeout(async () => {
            try {
              await api.indents.notifyStockout({
                itemName: item.name,
                itemCode: item.item_code || '',
                dept,
                requestedQty: parsedQty,
                unit
              });
            } catch (e) {
              console.warn('Stockout alert failed:', e);
            }
          }, 0);
        }

        setSuccessMsg(`✓ Instant Indent #${res.id || res.data?.id} submitted successfully to Central Store! ${currentStock <= 0 ? '(Out of stock — Store Manager alerted!)' : ''}`);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMsg(res?.error || 'Failed to submit indent.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error submitting indent.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open full Indent Desk screen with pre-filled item
  const handleOpenFullIndentScreen = () => {
    if (setIndentPreFill) {
      setIndentPreFill({
        dept,
        tab: 'manual',
        items: [
          {
            name: item.name,
            qty: parsedQty > 0 ? parsedQty : 1,
            unit,
            item_code: item.item_code || 'KPL-ITEM'
          }
        ]
      });
    }
    setCurrentScreen('indent');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: 16,
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: '#0f172a',
        border: '1.5px solid #e8a838',
        borderRadius: 20,
        width: '100%',
        maxWidth: 'min(540px, 90vw)',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(232, 168, 56, 0.25)',
        color: '#f8fafc',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(30, 41, 59, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'rgba(232, 168, 56, 0.15)',
              color: '#e8a838',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Utensils size={20} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                Raise Indent for Item
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Multi-Agent Kitchen Requisition Configurator
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#94a3b8',
              borderRadius: 8,
              padding: 6,
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div style={{
          padding: '18px 20px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          {/* Item Telemetry Banner */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>
                {item.name}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                SKU: <strong style={{ color: '#e8a838' }}>{item.item_code || 'KPL-GEN'}</strong> · {item.category || 'Kitchen Ingredients'}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              {parsedQty > 0 && currentStock <= 0 ? (
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'rgba(239, 68, 68, 0.22)',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#fca5a5',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <AlertTriangle size={12} style={{ color: '#ef4444' }} />
                  <span>Out of stock! Store Manager informed instantly.</span>
                </div>
              ) : currentStock > 0 ? (
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  display: 'inline-block'
                }}>
                  ● Available in Store
                </div>
              ) : null}
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                Unit: {unit}
              </div>
            </div>
          </div>

          {successMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid #10b981',
              color: '#34d399',
              fontSize: 13,
              fontWeight: 700
            }}>
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              fontSize: 13,
              fontWeight: 700
            }}>
              {errorMsg}
            </div>
          )}

          {/* Department Selection */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
              Kitchen Department / Station:
            </label>
            <select
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1.5px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 700,
                outline: 'none'
              }}
            >
              {depts.map((d) => (
                <option key={d} value={d} style={{ background: '#0f172a', color: '#ffffff' }}>
                  {d} Kitchen Station
                </option>
              ))}
            </select>
          </div>

          {/* Quantity & Steppers */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
                Requested Quantity:
              </label>
              <span style={{ fontSize: 12, color: '#e8a838', fontWeight: 700 }}>
                Est. Value: ₹{estimatedTotal.toFixed(2)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleStep(-1)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'manipulation'
                }}
              >
                <Minus size={18} />
              </button>

              <input
                type="number"
                min="0.1"
                step="0.5"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 10,
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1.5px solid #e8a838',
                  color: '#ffffff',
                  fontSize: 18,
                  fontWeight: 800,
                  textAlign: 'center',
                  outline: 'none'
                }}
              />

              <button
                type="button"
                onClick={() => handleStep(1)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: '#e8a838',
                  border: 'none',
                  color: '#080c14',
                  fontSize: 20,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'manipulation'
                }}
              >
                <Plus size={18} />
              </button>

              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{
                  height: 44,
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                  padding: '0 12px',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  outline: 'none'
                }}
              >
                {unitsList.map((u) => (
                  <option key={u} value={u} style={{ background: '#0f172a' }}>{u}</option>
                ))}
              </select>
            </div>

            {/* Quick Touch Increment Chips */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {incrementsList.map((inc) => (
                <button
                  key={inc}
                  type="button"
                  onClick={() => handleStep(inc)}
                  style={{
                    background: 'rgba(232, 168, 56, 0.12)',
                    border: '1px solid rgba(232, 168, 56, 0.3)',
                    color: '#e8a838',
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    touchAction: 'manipulation'
                  }}
                >
                  +{inc}
                </button>
              ))}
            </div>
          </div>

          {/* Priority & Shift Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                Urgency Priority:
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                  padding: '9px 12px',
                  color: priority === 'EMERGENCY' ? '#ef4444' : priority === 'URGENT' ? '#f59e0b' : '#10b981',
                  fontSize: 13,
                  fontWeight: 700,
                  outline: 'none'
                }}
              >
                {prioritiesList.map((p) => (
                  <option key={p.value} value={p.value} style={{ background: '#0f172a', color: p.color || '#ffffff' }}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                Service Shift:
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 10,
                  padding: '9px 12px',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  outline: 'none'
                }}
              >
                {shiftsList.map((s) => (
                  <option key={s.value} value={s.value} style={{ background: '#0f172a' }}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dish / Recipe Linkage (Agent Recipe Synthesizer) */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
              Target Dish / Recipe Association (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Breakfast Idli Batter, Dum Biryani 100 plates..."
              value={dishLink}
              onChange={(e) => setDishLink(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 10,
                padding: '9px 12px',
                color: '#ffffff',
                fontSize: 13,
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Chef Kitchen Notes */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
              Kitchen Station Notes & Delivery Remarks:
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Deliver directly to vegetable prep counter; need ripe batch..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 10,
                padding: '9px 12px',
                color: '#ffffff',
                fontSize: 13,
                boxSizing: 'border-box',
                resize: 'none'
              }}
            />
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{
          padding: '14px 20px',
          background: 'rgba(30, 41, 59, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Stage to Active Requisition */}
            <button
              onClick={handleStageToRequisition}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #e8a838 0%, #ca8a04 100%)',
                color: '#080c14',
                border: 'none',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 4px 16px rgba(232, 168, 56, 0.35)',
                touchAction: 'manipulation'
              }}
            >
              <ClipboardList size={16} /> Stage to Requisition Pad
            </button>

            {/* Direct Instant Dispatch */}
            <button
              onClick={handleDirectSubmit}
              disabled={submitting}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1.5px solid #10b981',
                color: '#34d399',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 13,
                fontWeight: 800,
                cursor: submitting ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                touchAction: 'manipulation'
              }}
            >
              <Send size={15} /> Instant Submit
            </button>
          </div>

          {/* Deep link: Open Full Indent Screen */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={handleOpenFullIndentScreen}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: 11,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px'
              }}
            >
              <span>Open in Full Multi-Department Indent Desk</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
