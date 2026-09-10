import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import * as api from '../api';
import {
  Package, ShoppingCart, ClipboardList, FileText,
  AlertTriangle, Clock, TrendingDown, CloudOff, CloudLightning,
  PlusCircle, Activity, MessageSquare, Sparkles, Bell, Send, FileSpreadsheet, Building2
} from 'lucide-react';
import Card from '../components/Card';
import Btn from '../components/Btn';
import ExportReportModal from '../components/ExportReportModal';
import MultiAgentStatusBar from '../components/MultiAgentStatusBar';
import { COLORS } from '../styles/colors';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

const MODULE_CARDS = [
  {
    id: 'store_manager_available_stock',
    icon: <Package size={28} />,
    title: 'Available Stock',
    description: 'View current stock levels, expiry alerts, and inventory health across all items.',
    accentColor: COLORS.warning,
    bgAccent: 'rgba(245, 158, 11, 0.1)',
  },
  {
    id: 'store_manager_stock_purchase',
    icon: <ShoppingCart size={28} />,
    title: 'Receive Stock',
    description: 'Record new stock purchases, scan receipts, and update supplier information.',
    accentColor: COLORS.warning,
    bgAccent: 'rgba(245, 158, 11, 0.1)',
  },
  {
    id: 'pos',
    icon: <FileText size={28} />,
    title: 'Purchase Orders',
    description: 'Same Purchase Orders window as admin — create, approve, mark sent/received, print.',
    accentColor: COLORS.warning,
    bgAccent: 'rgba(245, 158, 11, 0.1)',
  },
  {
    id: 'suppliers',
    icon: <Building2 size={28} />,
    title: 'Vendors & Suppliers',
    description: 'Register and manage vendor profiles, GSTIN, contacts, and live reliability benchmarks.',
    accentColor: COLORS.warning,
    bgAccent: 'rgba(245, 158, 11, 0.1)',
  },
  {
    id: 'store_manager_store_issuance',
    icon: <ClipboardList size={28} />,
    title: 'Store Issuance',
    description: 'Issue materials to kitchens and departments against pending indent requests with LIFO priority.',
    accentColor: COLORS.warning,
    bgAccent: 'rgba(245, 158, 11, 0.1)',
  },
  {
    id: 'store_manager_indent',
    icon: <FileText size={28} />,
    title: 'Indent Request',
    description: 'View, review, and manage department material indent requests. Smart auto-indent and recipe planner included.',
    accentColor: COLORS.warning,
    bgAccent: 'rgba(245, 158, 11, 0.1)',
  },
];

export default function StoreManagerHome() {
  const { user, logout } = useAuth();
  const { setCurrentScreen, setIndentPreFill } = useAppContext();
  const [hoveredCard, setHoveredCard] = useState(null);

  // KPIs
  const [pendingIndents, setPendingIndents] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [todayIssuances, setTodayIssuances] = useState(0);
  const [todayStockEntries, setTodayStockEntries] = useState(0);
  const [issuanceTrend, setIssuanceTrend] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  // Recent Activity
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  // Offline Sync
  const [offlineCount, setOfflineCount] = useState(0);

  // Shift Notes
  const [handoffNote, setHandoffNote] = useState('');
  const [handoffShift, setHandoffShift] = useState('Morning');
  const [aiSummary, setAiSummary] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // Morning Briefing
  const [briefing, setBriefing] = useState('');
  const [loadingBriefing, setLoadingBriefing] = useState(true);

  // Predictive Reorders
  const [predictiveAlerts, setPredictiveAlerts] = useState([]);
  const [loadingPredictive, setLoadingPredictive] = useState(true);
  const [showAllPredictive, setShowAllPredictive] = useState(false);

  // Adhoc vs Routine indent breakdown
  const [adhocSummary, setAdhocSummary] = useState(null);

  // High-value alert count (last 7 days)
  const [highValueAlertCount, setHighValueAlertCount] = useState(0);

  // Toast — replaces native alert() for consistency with the rest of the app
  const [toast, setToast] = useState('');
  const flash = (text) => { setToast(text); setTimeout(() => setToast(''), 4000); };

  // Recent Alerts (notifications) — high-value + anomaly
  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);

  // Day-close digest quick action
  const [departments, setDepartments] = useState([]);
  const [digestDept, setDigestDept] = useState('');
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestMsg, setDigestMsg] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    const checkOffline = () => {
      const q1 = JSON.parse(localStorage.getItem('kapila_offline_stock') || '[]');
      const q2 = JSON.parse(localStorage.getItem('kapila_offline_issuances') || '[]');
      setOfflineCount(q1.length + q2.length);
    };
    checkOffline();
    window.addEventListener('online', checkOffline);
    return () => window.removeEventListener('online', checkOffline);
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setLoadingPredictive(true);
      try {
        const [homeRes, predictiveRes, summaryRes] = await Promise.all([
          api.dashboard.storeHome(),
          api.reorderPoints.predictive(),
          api.dashboard.summary().catch(() => ({ success: false }))
        ]);

        if (summaryRes.success) {
          setLowStockItems((summaryRes.data.low_stock_items || []).slice(0, 8));
        }

        if (homeRes.success) {
          const d = homeRes.data;
          setPendingIndents(d.pending_indents || 0);
          setLowStockCount(d.low_stock_count || 0);
          setExpiringCount(d.expiring_soon_count || 0);
          setTodayIssuances(d.today_issuances || 0);
          setTodayStockEntries(d.today_stock_entries || 0);
          setHighValueAlertCount(d.high_value_alert_count || 0);
          setRecentActivity(d.recent_activity || []);
          setIssuanceTrend(d.issuance_trend || []);
        }

        if (predictiveRes.success) {
          const activeAlerts = (predictiveRes.data || []).filter(item => item.needs_reorder);
          setPredictiveAlerts(activeAlerts);
        }

      } catch (err) {
        console.error("Failed to load dashboard metrics", err);
      }
      setLoading(false);
      setLoadingPredictive(false);
    };

    const loadBriefing = async () => {
      setLoadingBriefing(true);
      try {
        const res = await api.dashboard.morningBriefing();
        if (res.success) {
          setBriefing(res.briefing);
        }
      } catch (err) {
        console.error("Failed to load briefing", err);
      }
      setLoadingBriefing(false);
    };

    const loadLatestHandoff = async () => {
      try {
        const res = await api.handoffs.latest();
        if (res.success && res.data) {
          setHandoffNote(res.data.note || '');
          setHandoffShift(res.data.shift_type || 'Morning');
          setAiSummary(res.data.ai_summary || '');
        }
      } catch (err) {
        console.error("Failed to load latest handoff", err);
      }
    };

    const loadAdhocSummary = async () => {
      try {
        const res = await api.dashboard.adhocSummary(7);
        if (res.success) setAdhocSummary(res.data);
      } catch (err) {
        console.error("Failed to load adhoc summary", err);
      }
    };

    const loadAlerts = async () => {
      setLoadingAlerts(true);
      try {
        const res = await api.notifications.list();
        if (res.success) setAlerts(res.data || []);
      } catch (err) {
        console.error("Failed to load alerts", err);
      }
      setLoadingAlerts(false);
    };

    const loadDepartments = async () => {
      try {
        const res = await api.departments.list();
        if (res.success) {
          const depts = res.data || [];
          setDepartments(depts);
          if (depts.length) setDigestDept(depts[0].name);
        }
      } catch (err) {
        console.error("Failed to load departments", err);
      }
    };

    loadDashboard();
    loadBriefing();
    loadLatestHandoff();
    loadAdhocSummary();
    loadAlerts();
    loadDepartments();
  }, []);

  const handleSendDayDigest = async () => {
    if (!digestDept) return;
    setSendingDigest(true);
    setDigestMsg('');
    try {
      const res = await api.indents.closeDay({ dept: digestDept });
      setDigestMsg(res.message || 'Digest sent ✓');
    } catch (err) {
      setDigestMsg('Failed: ' + err.message);
    }
    setSendingDigest(false);
    setTimeout(() => setDigestMsg(''), 4000);
  };

  const handleSaveHandoff = async () => {
    setNoteSaving(true);
    try {
      const res = await api.handoffs.create({
        shift_type: handoffShift,
        note: handoffNote
      });
      if (res.success) {
        setAiSummary(res.data.ai_summary || '');
        alert("Shift handoff saved & AI summary generated!");
      }
    } catch (err) {
      console.error("Failed to save handoff", err);
      alert("Failed to save handoff.");
    }
    setNoteSaving(false);
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div style={{
      minHeight: '100%',
      backgroundColor: 'transparent',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 1000,
          background: 'var(--text-main)', color: '#fff', padding: '10px 16px',
          borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxWidth: 340,
        }}>
          {toast}
        </div>
      )}

      {/* Main content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 0 32px 0',
      }}>
        <div style={{ width: '100%', maxWidth: '1100px' }}>
          {/* Sync Status Banner */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            {offlineCount > 0 ? (
              <span style={{ fontSize: 12, background: 'var(--color-warning)', color: '#fff', padding: '4px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <CloudOff size={13} /> {offlineCount} Pending Sync
              </span>
            ) : (
              <span style={{ fontSize: 12, background: 'rgba(16, 185, 129, 0.12)', color: '#047857', padding: '4px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <CloudLightning size={13} /> All Synced
              </span>
            )}
          </div>

          {/* Greeting */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
            <div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 700,
                color: COLORS.text,
                margin: 0,
                marginBottom: '8px',
                fontFamily: 'var(--font-display, inherit)',
              }}>
                {greeting()}, {user?.name || 'Store Manager'} 👋
              </h1>
              <p style={{ fontSize: '15px', color: COLORS.muted, margin: 0 }}>
                Here is your store overview for today.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Btn
                onClick={() => setCurrentScreen('store_manager_stock_purchase')}
                icon={<PlusCircle size={16} />}
                style={{ backgroundColor: 'var(--color-gold)', borderColor: 'var(--color-gold)', color: '#18181b', fontWeight: 600, boxShadow: 'var(--shadow-sm)' }}
              >
                Receive Stock
              </Btn>
              <Btn
                onClick={() => setCurrentScreen('store_manager_store_issuance')}
                icon={<Activity size={16} />}
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)', fontWeight: 600, boxShadow: 'var(--shadow-sm)' }}
              >
                Issue Materials
              </Btn>
              <Btn
                onClick={() => setCurrentScreen('suppliers')}
                icon={<Building2 size={16} />}
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)', fontWeight: 600, boxShadow: 'var(--shadow-sm)' }}
              >
                Vendors & Suppliers
              </Btn>
              <Btn
                onClick={() => setIsExportModalOpen(true)}
                icon={<FileSpreadsheet size={16} color="var(--color-gold-dark)" />}
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-main)', fontWeight: 600, boxShadow: 'var(--shadow-sm)' }}
              >
                Export Excel Report
              </Btn>
            </div>
          </div>

          {/* Multi-Agent Swarm Status Bar & LIFO Advisory */}
          <div style={{ marginBottom: '20px' }}>
            <MultiAgentStatusBar
              customNote="Multi-agent swarm active: Real-time Vendor Intelligence, LIFO Batch Valuation, and Stock Balance integrity verified"
            />
          </div>

          {/* KPI Row — glance metrics, top priority */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <Card
              style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer', borderLeft: `4px solid ${COLORS.warning}`, background: '#ffffff' }}
              onClick={() => {
                if (setIndentPreFill) setIndentPreFill({ tab: 'history', statusFilter: 'pending' });
                setCurrentScreen('store_manager_indent');
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: COLORS.muted, fontSize: '13px', fontWeight: 600 }}>
                <FileText size={16} color={COLORS.warning} /> Pending Indents
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.text }}>
                {loading ? '-' : pendingIndents}
              </div>
            </Card>

            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer', borderLeft: `4px solid ${COLORS.warning}`, background: '#ffffff' }} onClick={() => setCurrentScreen('store_manager_available_stock')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: COLORS.muted, fontSize: '13px', fontWeight: 600 }}>
                <TrendingDown size={16} color={COLORS.warning} /> Low Stock
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.text }}>
                {loading ? '-' : lowStockCount}
              </div>
            </Card>

            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer', borderLeft: `4px solid ${COLORS.warning}`, background: '#ffffff' }} onClick={() => setCurrentScreen('store_manager_available_stock')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: COLORS.muted, fontSize: '13px', fontWeight: 600 }}>
                <AlertTriangle size={16} color={COLORS.warning} /> Expiring Soon
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.text }}>
                {loading ? '-' : expiringCount}
              </div>
            </Card>

            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: `4px solid ${COLORS.warning}`, background: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: COLORS.muted, fontSize: '13px', fontWeight: 600 }}>
                <Activity size={16} color={COLORS.warning} /> Today's Issuances
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.text }}>
                {loading ? '-' : todayIssuances}
              </div>
            </Card>

            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: `4px solid ${COLORS.warning}`, background: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: COLORS.muted, fontSize: '13px', fontWeight: 600 }}>
                <Package size={16} color={COLORS.warning} /> Stock Entries
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.text }}>
                {loading ? '-' : todayStockEntries}
              </div>
            </Card>

            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: `4px solid ${COLORS.danger}`, background: '#ffffff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: COLORS.muted, fontSize: '13px', fontWeight: 600 }}>
                <AlertTriangle size={16} color={COLORS.danger} /> High Value Alerts (7d)
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: COLORS.text }}>
                {loading ? '-' : highValueAlertCount}
              </div>
            </Card>
          </div>

          {/* Module Cards — quick nav, own full-width row */}
          <div className="resp-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            {MODULE_CARDS.map((card) => {
              const isHovered = hoveredCard === card.id;
              return (
                <button
                  key={card.id}
                  onClick={() => {
                    if (card.id === 'store_manager_indent' && setIndentPreFill) {
                      setIndentPreFill({ tab: 'history' });
                    }
                    setCurrentScreen(card.id);
                  }}
                  onMouseEnter={() => setHoveredCard(card.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    background: '#ffffff',
                    border: `1px solid ${isHovered ? card.accentColor : '#e2e8f0'}`,
                    borderRadius: '16px',
                    padding: '24px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.18s ease',
                    boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
                    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    outline: 'none',
                  }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: card.bgAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.accentColor }}>
                    {card.icon}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 700, color: COLORS.text, margin: '0 0 6px 0' }}>{card.title}</h2>
                    <p style={{ fontSize: '13px', color: COLORS.muted, margin: 0, lineHeight: '1.5' }}>{card.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* AI Morning Briefing */}
          <div style={{
            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: `1px solid ${COLORS.warning}`,
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '32px',
            color: COLORS.text,
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.12)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              fontSize: '120px',
              opacity: 0.08,
              color: COLORS.warning,
              pointerEvents: 'none'
            }}>
              ✨
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Sparkles size={20} color={COLORS.warning} />
              <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#92400E', fontFamily: 'sans-serif' }}>
                AI Morning Briefing
              </span>
            </div>
            <p style={{
              fontSize: '14px',
              lineHeight: '1.6',
              margin: 0,
              color: COLORS.text,
              fontWeight: 500,
              whiteSpace: 'pre-line'
            }}>
              {loadingBriefing ? 'Synthesizing inventory status and shift logs...' : briefing}
            </p>
          </div>

          {/* AI Predictive Reorder Alerts */}
          {predictiveAlerts.length > 0 && (
            <div style={{
              background: '#ffffff',
              border: `1.5px solid ${COLORS.warning}`,
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '32px',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ fontSize: '20px' }}>🔮</span>
                <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '0.05em', textTransform: 'uppercase', color: '#92400E', fontFamily: 'sans-serif' }}>
                  AI Predictive Reorder Alerts
                </span>
                <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#92400E', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700, marginLeft: 'auto' }}>
                  {predictiveAlerts.length} Urgent Items
                </span>
                {predictiveAlerts.length > 3 && (
                  <button
                    onClick={() => setShowAllPredictive((v) => !v)}
                    style={{ background: 'none', border: 'none', color: COLORS.warning, fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '2px 8px' }}
                  >
                    {showAllPredictive ? 'Collapse' : `Show all ${predictiveAlerts.length}`}
                  </button>
                )}
              </div>

              <div style={{
                display: 'flex', flexDirection: 'column', gap: 16,
                maxHeight: showAllPredictive ? 'none' : 420,
                overflowY: showAllPredictive ? 'visible' : 'auto',
                paddingRight: 4
              }}>
                {(showAllPredictive ? predictiveAlerts : predictiveAlerts.slice(0, 3)).map((alert) => (
                  <div key={alert.item_code} style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: '#F8FAFC',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    gap: 12
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: COLORS.text }}>
                          {alert.name}
                        </h4>
                        <span style={{ fontSize: '12px', color: COLORS.muted, fontFamily: 'monospace' }}>
                          ({alert.item_code})
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8, fontSize: '13px', color: COLORS.muted }}>
                        <span>
                          Current Stock: <strong style={{ color: COLORS.text }}>{alert.current_stock} {alert.unit}</strong>
                        </span>
                        <span>
                          Velocity: <strong style={{ color: COLORS.text }}>{alert.velocity} {alert.unit}/day</strong>
                        </span>
                        <span style={{ color: alert.days_to_out <= 1 ? COLORS.danger : COLORS.warning, fontWeight: 600 }}>
                          Stockout in: {alert.days_to_out === 0 ? 'Out of stock' : `${alert.days_to_out} days`}
                        </span>
                      </div>

                      {/* Supplier recommendations and comparisons */}
                      <div style={{ marginTop: 8, fontSize: '12px', color: COLORS.muted }}>
                        <span>Recommended Supplier: <strong style={{ color: COLORS.text }}>{alert.recommended_supplier || "No supplier on record"}</strong> {alert.recommended_price ? `(₹${alert.recommended_price}/${alert.unit})` : ''}</span>
                        {alert.comparisons && alert.comparisons.length > 1 && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontStyle: 'italic' }}>Other rates:</span>
                            {alert.comparisons.slice(1, 3).map((comp, idx) => (
                              <span key={idx} style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4, color: COLORS.text }}>
                                {comp.supplier}: ₹{comp.price}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      {alert.preferred_supplier_id ? (
                        <Btn
                          onClick={() => {
                            api.purchaseOrders.autoDraft(alert.preferred_supplier_id)
                              .then(res => {
                                if (res.success) {
                                  flash(`Draft PO created: ${res.data.po_number} — routed for approval ✓`);
                                  setCurrentScreen('store_manager_stock_purchase');
                                }
                              })
                              .catch(err => {
                                console.error(err);
                                flash("Failed to draft PO: " + err.message);
                              });
                          }}
                          style={{ padding: '8px 12px', fontSize: '12px', height: '36px', minHeight: '36px', background: COLORS.brand, borderColor: COLORS.brand, color: '#ffffff' }}
                        >
                          Draft PO
                        </Btn>
                      ) : (
                        <span title="No preferred supplier set for this item — set one in Reorder Points to enable Draft PO" style={{ fontSize: 11, color: COLORS.muted, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                          No preferred supplier
                        </span>
                      )}
                      {alert.wa_link && (
                        <a
                          href={alert.wa_link}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '8px',
                            height: '36px',
                            backgroundColor: '#25D366',
                            color: '#ffffff',
                            textDecoration: 'none',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Send WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Adhoc vs Routine Requests — last 7 days */}
          {adhocSummary && (adhocSummary.adhoc_count > 0 || adhocSummary.routine_count > 0) && (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px 24px', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>📋</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>Adhoc vs Routine Requests (7d)</span>
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: adhocSummary.top_adhoc_items?.length ? 14 : 0 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.danger }}>{adhocSummary.adhoc_count}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>Adhoc requests</div>
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.text }}>{adhocSummary.routine_count}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>Routine requests</div>
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.text }}>₹{adhocSummary.adhoc_value.toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: 12, color: COLORS.muted }}>Adhoc value</div>
                </div>
                {adhocSummary.by_dept?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{adhocSummary.by_dept[0].dept}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>Top adhoc dept ({adhocSummary.by_dept[0].count})</div>
                  </div>
                )}
              </div>
              {adhocSummary.top_adhoc_items?.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontStyle: 'italic', color: COLORS.muted }}>Recurring adhoc items (consider adding reorder point):</span>
                  {adhocSummary.top_adhoc_items.slice(0, 5).map((it, idx) => (
                    <span key={idx} style={{ background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>
                      {it.name} ×{it.occurrences}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Charts Row — own full-width space, no longer cramped in a sidebar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <Card style={{ padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6, color: COLORS.text }}>
                <Activity size={16} color={COLORS.warning} /> Issuances — Last 7 Days
              </h3>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <BarChart data={issuanceTrend}>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: COLORS.muted }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#F8FAFC' }} />
                    <Bar dataKey="count" fill={COLORS.brand} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {lowStockItems.length > 0 && (
              <Card style={{ padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6, color: COLORS.text }}>
                  <TrendingDown size={16} color={COLORS.danger} /> Lowest Stock Items
                </h3>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={lowStockItems} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#e2e8f0" />
                      <XAxis type="number" hide domain={[0, 100]} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: COLORS.muted }} width={90} />
                      <Tooltip cursor={{ fill: '#F8FAFC' }} formatter={(v) => `${v}% remaining`} />
                      <Bar dataKey="pct" fill={COLORS.danger} radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>

          {/* Detail Cards Row — 3-col, room to grow: drop future widgets in here */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px', alignItems: 'start' }}>

            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: COLORS.text }}>
                <MessageSquare size={16} color={COLORS.warning} /> Shift Handoff Notes
              </h3>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: COLORS.muted, fontWeight: 600 }}>Shift:</span>
                <select
                  value={handoffShift}
                  onChange={(e) => setHandoffShift(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    backgroundColor: '#ffffff',
                    color: COLORS.text,
                    outline: 'none'
                  }}
                >
                  <option value="Morning">Morning Shift</option>
                  <option value="Evening">Evening Shift</option>
                </select>
              </div>

              <textarea
                value={handoffNote}
                onChange={(e) => setHandoffNote(e.target.value)}
                placeholder="Leave a note for the next shift manager..."
                style={{
                  width: '100%',
                  height: '100px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#F8FAFC',
                  resize: 'none',
                  fontSize: '13px',
                  color: COLORS.text,
                  fontFamily: 'inherit',
                  outline: 'none'
                }}
              />

              <button
                onClick={handleSaveHandoff}
                disabled={noteSaving || !handoffNote.trim()}
                style={{
                  backgroundColor: COLORS.brand,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: (noteSaving || !handoffNote.trim()) ? 0.6 : 1,
                }}
              >
                {noteSaving ? 'Saving & Generating...' : 'Save & Sync Handoff'}
              </button>

              {aiSummary && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#FFFBEB',
                  border: `1px solid ${COLORS.warning}`,
                  fontSize: '12px',
                  lineHeight: '1.5',
                  color: COLORS.text
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '6px', color: '#92400E' }}>
                    <Sparkles size={14} /> AI Shift Handoff Summary
                  </div>
                  <div style={{ whiteSpace: 'pre-line' }}>{aiSummary}</div>
                </div>
              )}
            </Card>

            <Card style={{ padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 6, color: COLORS.text }}>
                <Clock size={16} color={COLORS.warning} /> Recent Activity
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {loading ? (
                  <div style={{ fontSize: '13px', color: COLORS.muted }}>Loading feed...</div>
                ) : recentActivity.length > 0 ? (
                  recentActivity.map((act, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS.warning, marginTop: '6px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: COLORS.text }}>{act.desc}</div>
                        <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '2px' }}>
                          {new Date(act.date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '13px', color: COLORS.muted }}>No recent activity found.</div>
                )}
              </div>
            </Card>

            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: COLORS.text }}>
                <Bell size={16} color={COLORS.danger} /> Recent Alerts
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 220, overflowY: 'auto' }}>
                {loadingAlerts ? (
                  <div style={{ fontSize: '13px', color: COLORS.muted }}>Loading alerts...</div>
                ) : alerts.length > 0 ? (
                  alerts.slice(0, 8).map((a) => (
                    <div key={a.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                        backgroundColor: a.severity === 'critical' ? COLORS.danger : (a.severity === 'warning' ? COLORS.warning : COLORS.muted),
                      }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>{a.title}</div>
                        <div style={{ fontSize: '12px', color: COLORS.muted, marginTop: '2px', whiteSpace: 'pre-line' }}>{a.message}</div>
                        <div style={{ fontSize: '11px', color: COLORS.muted, marginTop: '2px' }}>
                          {new Date(a.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '13px', color: COLORS.muted }}>No alerts — all clear.</div>
                )}
              </div>
            </Card>

            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: COLORS.text }}>
                <Send size={16} color={COLORS.warning} /> Day-Close WhatsApp Digest
              </h3>
              <p style={{ fontSize: '12px', color: COLORS.muted, margin: 0 }}>
                Sends indent #, total value, issuance time, and high-value flags for every fully-issued indent today.
              </p>
              <select
                value={digestDept}
                onChange={(e) => setDigestDept(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', backgroundColor: '#F8FAFC', color: COLORS.text, outline: 'none' }}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
              <button
                onClick={handleSendDayDigest}
                disabled={sendingDigest || !digestDept}
                style={{
                  backgroundColor: COLORS.brand, color: '#ffffff', border: 'none', borderRadius: '8px',
                  padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  opacity: (sendingDigest || !digestDept) ? 0.6 : 1,
                }}
              >
                {sendingDigest ? 'Sending...' : 'Send Day Digest'}
              </button>
              {digestMsg && (
                <div style={{ fontSize: '12px', color: COLORS.text }}>{digestMsg}</div>
              )}
            </Card>

            {/* Future widgets slot in here as more Card entries — grid auto-wraps */}

          </div>

        </div>
      </main>
      <ExportReportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
    </div>
  );
}
