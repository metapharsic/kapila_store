import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import * as api from '../api';
import kapilaLogo from '../assets/kapila-logo.png';
import { 
  ChefHat, ClipboardList, UtensilsCrossed, BarChart3, 
  ShieldCheck, LogOut, ArrowRight, Sparkles, TrendingUp, AlertTriangle,
  Smartphone, Tablet, Monitor, Search
} from 'lucide-react';
import ChefRequisitionWorkspace from '../components/chef/ChefRequisitionWorkspace';
import RaiseIndentItemModal from '../components/chef/RaiseIndentItemModal';

const MODULE_CARDS = [
  {
    id: 'production_planner',
    icon: <UtensilsCrossed size={26} />,
    title: 'Production Planner',
    description: 'View daily menus, scaled recipes, and kitchen prep tasks.',
    accentColor: '#8b5cf6', // purple
    bgAccent: 'rgba(139, 92, 246, 0.12)',
    badge: 'Daily Recipes'
  },
  {
    id: 'indent',
    icon: <ClipboardList size={26} />,
    title: 'Indent Material',
    description: 'Request kitchen ingredients from Central Store for nightly replenishment.',
    accentColor: '#f59e0b', // amber
    bgAccent: 'rgba(245, 158, 11, 0.12)',
    badge: 'Store Request'
  },
  {
    id: 'chef_stats',
    icon: <BarChart3 size={26} />,
    title: 'Chef Statistics',
    description: 'Track department consumption, yield efficiency, and cost per plate.',
    accentColor: '#3b82f6', // blue
    bgAccent: 'rgba(59, 130, 246, 0.12)',
    badge: 'Analytics'
  },
  {
    id: 'production',
    icon: <ChefHat size={26} />,
    title: 'Daily Production & Waste',
    description: 'Log finished food plates, record kitchen leftovers, and waste.',
    accentColor: '#10b981', // green
    bgAccent: 'rgba(16, 185, 129, 0.12)',
    badge: 'Kitchen Log · Admin',
    adminOnly: true
  },
];

export const DEPARTMENT_TILES = [
  {
    name: 'TIFFINS',
    code: 'TFN',
    icon: '🥞',
    color: '#e8a838',
    bg: 'rgba(232, 168, 56, 0.14)',
    desc: 'Breakfast, Idli, Dosa & Batter'
  },
  {
    name: 'STAFF',
    code: 'STF',
    icon: '👥',
    color: '#3b82f6',
    bg: 'rgba(59, 130, 246, 0.14)',
    desc: 'Staff Kitchen Meals & Rations'
  },
  {
    name: 'SI-MEALS',
    code: 'SIM',
    icon: '🍛',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.14)',
    desc: 'South Indian Thali, Sambar & Dal'
  },
  {
    name: 'NORTH INDIAN',
    code: 'NIN',
    icon: '🥘',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.14)',
    desc: 'Gravies, Paneer, Roti & Biryani'
  },
  {
    name: 'CHAT & SOFTY',
    code: 'CHT',
    icon: '🍦',
    color: '#ec4899',
    bg: 'rgba(236, 72, 153, 0.14)',
    desc: 'Chaat, Softies & JP Disposables'
  },
  {
    name: 'CHINESE & DOSA',
    code: 'CND',
    icon: '🍜',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.14)',
    desc: 'Noodles, Fried Rice & Special Dosas'
  },
  {
    name: 'MOCKTAILS & CONTINENTAL',
    code: 'MCT',
    icon: '🍹',
    color: '#8b5cf6',
    bg: 'rgba(139, 92, 246, 0.14)',
    desc: 'Mocktails, Shakes, Pizzas & Pastas'
  },
  {
    name: 'RESTAURANT',
    code: 'RST',
    icon: '🍽️',
    color: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.14)',
    desc: 'Main Dining Service & Dairy'
  },
  {
    name: 'ROOM SERVICE',
    code: 'RMS',
    icon: '🛎️',
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.14)',
    desc: 'In-Room Dining Orders & Supplies'
  }
];

export default function ChefHome() {
  const { user, roles = [], logout } = useAuth();
  const isAdmin = roles.some(r => r.key === 'admin' || r.key === 'director');
  const visibleModuleCards = MODULE_CARDS.filter(card => !card.adminOnly || isAdmin);
  const { setCurrentScreen, setIndentPreFill } = useAppContext();
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredDept, setHoveredDept] = useState(null);
  const [stats, setStats] = useState(null);

  // Viewport detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth <= 540);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  useEffect(() => {
    if (!isAdmin) return; // Cost/yield KPIs are admin-only; skip the fetch for non-admins.
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const today = d.toISOString().slice(0, 10);

    api.chefStats.overview({ date_from: firstDay, date_to: today })
      .then(res => {
        if (res.success && res.data.length > 0) {
          const totalPlates = res.data.reduce((sum, d) => sum + (d.total_plates || 0), 0);
          const totalCost = res.data.reduce((sum, d) => sum + (d.estimated_cost || 0), 0);
          const totalAnomalies = res.data.reduce((sum, d) => sum + (d.total_anomalies || 0), 0);
          const costPerPlate = totalPlates > 0 ? (totalCost / totalPlates).toFixed(2) : '0.00';
          setStats({
            plates: totalPlates,
            costPerPlate,
            anomalies: totalAnomalies
          });
        }
      })
      .catch(console.error);
  }, [isAdmin]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const [showWorkspace, setShowWorkspace] = useState(false);
  const [workspaceDept, setWorkspaceDept] = useState('TIFFINS');
  const [indentModalItem, setIndentModalItem] = useState(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [quickResults, setQuickResults] = useState([]);
  const [quickLoading, setQuickLoading] = useState(false);

  const [departmentsList, setDepartmentsList] = useState([]);

  useEffect(() => {
    let isMounted = true;
    if (api.departments && api.departments.list) {
      api.departments.list().then((res) => {
        if (!isMounted) return;
        const list = res?.data || res || [];
        if (Array.isArray(list) && list.length > 0) {
          setDepartmentsList(list);
        }
      }).catch((err) => {
        console.error('Failed to load departments from database:', err);
      });
    }
    return () => { isMounted = false; };
  }, []);

  const [departmentItemCounts, setDepartmentItemCounts] = useState(null); // null = loading, {} = loaded (possibly empty), 'error' = failed
  useEffect(() => {
    let isMounted = true;
    Promise.resolve()
      .then(() => {
        if (!api.departments || !api.departments.itemCounts) {
          throw new Error('departments.itemCounts API not available');
        }
        return api.departments.itemCounts();
      })
      .then((res) => {
        if (!isMounted) return;
        const rows = res?.data || res || [];
        const map = {};
        if (Array.isArray(rows)) {
          rows.forEach((r) => {
            const key = (r.name || '').trim().toUpperCase();
            if (key) map[key] = r.item_count;
          });
        }
        setDepartmentItemCounts(map);
      })
      .catch((err) => {
        console.error('Failed to load department item counts:', err);
        if (isMounted) setDepartmentItemCounts('error');
      });
    return () => { isMounted = false; };
  }, []);

  const activeDepartments = departmentsList.length > 0 ? departmentsList : DEPARTMENT_TILES;

  const getDeptItemCount = (dept) => {
    if (typeof dept.itemsCount === 'number') return dept.itemsCount; // live count already attached by backend (e.g. /departments)
    if (departmentItemCounts === null) return '…';
    if (departmentItemCounts === 'error') return '—';
    const key = (dept.name || '').trim().toUpperCase();
    const count = departmentItemCounts[key];
    return typeof count === 'number' ? count : '—';
  };

  useEffect(() => {
    const q = quickSearch.trim();
    if (q.length < 2) {
      setQuickResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setQuickLoading(true);
      try {
        const res = await api.stock.list({ q, limit: 8 });
        const list = res?.data || res || [];
        setQuickResults(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Quick stock search error:', err);
      } finally {
        setQuickLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [quickSearch]);

  const handleOpenDeptIndent = (deptName) => {
    setWorkspaceDept(deptName);
    setShowWorkspace(true);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 50% 10%, #162032 0%, #080c14 90%)',
      display: 'flex',
      flexDirection: 'column',
      color: '#f1f5f9',
      fontFamily: 'var(--font-sans)',
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        borderBottom: '1px solid rgba(232, 168, 56, 0.2)',
        padding: isMobile ? '0 16px' : '0 32px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={kapilaLogo} alt="Kapila" style={{ height: 32, objectFit: 'contain' }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 20,
            padding: '3px 10px',
            fontSize: 11,
            color: '#10b981',
            fontWeight: 700
          }}>
            <ChefHat size={14} /> Kitchen Terminal
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => setShowWorkspace(prev => !prev)}
            style={{
              background: showWorkspace ? 'rgba(232, 168, 56, 0.2)' : 'rgba(30, 41, 59, 0.8)',
              border: `1.5px solid ${showWorkspace ? '#e8a838' : 'rgba(255, 255, 255, 0.15)'}`,
              color: showWorkspace ? '#e8a838' : '#ffffff',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.15s ease',
              touchAction: 'manipulation'
            }}
          >
            <ClipboardList size={15} />
            <span>{showWorkspace ? 'Requisition: OPEN' : 'Touch Requisition'}</span>
          </button>

          <button
            onClick={logout}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
              touchAction: 'manipulation'
            }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: isMobile ? '24px 16px 40px' : '36px 24px 60px',
        maxWidth: 1100,
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>

        {/* Greeting Section */}
        <div style={{ textAlign: 'center', marginBottom: 28, width: '100%' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(232, 168, 56, 0.1)',
            border: '1px solid rgba(232, 168, 56, 0.25)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11,
            color: '#e8a838',
            fontWeight: 700,
            marginBottom: 10
          }}>
            <Sparkles size={12} /> Executive Kitchen Station · Hotel Kapila
          </div>

          <h1 style={{
            fontSize: isMobile ? '24px' : '32px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0 0 6px',
            fontFamily: 'var(--font-display, inherit)',
            letterSpacing: '0.02em'
          }}>
            {greeting()}, {user?.name || 'Chef'} 👋
          </h1>
          <p style={{
            fontSize: isMobile ? '13px' : '15px',
            color: '#94a3b8',
            margin: 0,
          }}>
            Touch an operational module below to plan production or submit indents
          </p>
        </div>

        {/* Quick Stats Strip (Cost/Yield KPIs — Admin only) */}
        {isAdmin && (
        <div style={{
          width: '100%',
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: isMobile ? '16px' : '20px 28px',
          marginBottom: 28,
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 16,
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
          boxSizing: 'border-box'
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 4 }}>
              Month's Plates
            </div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#ffffff' }}>
              {stats?.plates ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <TrendingUp size={12} /> Kitchen Output Active
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 4 }}>
              Cost Per Plate
            </div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: '#e8a838' }}>
              ₹{stats?.costPerPlate ?? '0.00'}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              Yield Efficiency
            </div>
          </div>

          <div style={{ gridColumn: isMobile ? 'span 2' : 'auto' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 4 }}>
              Yield Anomalies
            </div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: (stats?.anomalies || 0) > 0 ? '#ef4444' : '#10b981' }}>
              {stats?.anomalies ?? 0}
            </div>
            <div style={{ fontSize: 11, color: (stats?.anomalies || 0) > 0 ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              {(stats?.anomalies || 0) > 0 ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
              {(stats?.anomalies || 0) > 0 ? 'Requires Waste Review' : 'Zero Quality Breaches'}
            </div>
          </div>
        </div>
        )}

        {/* Chef Touch Requisition Cockpit & Station Radar Banner */}
        <div style={{
          width: '100%',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1.5px solid rgba(232, 168, 56, 0.35)',
          borderRadius: 16,
          padding: isMobile ? '16px' : '20px 24px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(232, 168, 56, 0.1)',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(232, 168, 56, 0.15)',
              color: '#e8a838',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <UtensilsCrossed size={24} />
            </div>
            <div>
              <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Chef Keen Requisition Cockpit & Station Radar</span>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
                See what is required very keenly: Central Store live balances, critical shortages, daily staples & single-indent disposables. Flexible windowing lets you dock anywhere.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setShowWorkspace(true)}
              style={{
                background: 'linear-gradient(135deg, #e8a838 0%, #ca8a04 100%)',
                color: '#080c14',
                border: 'none',
                borderRadius: 10,
                padding: '10px 18px',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 16px rgba(232, 168, 56, 0.35)',
                touchAction: 'manipulation'
              }}
            >
              <ClipboardList size={16} /> Open Touch Requisition
            </button>
          </div>
        </div>

        {/* Quick Department Indents Section (Layman Chef Friendly) */}
        <div style={{ width: '100%', marginBottom: 28 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h2 style={{
                fontSize: isMobile ? 16 : 18,
                fontWeight: 800,
                color: '#ffffff',
                margin: '0 0 4px',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span>📋 Quick Department Indents</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: '1px solid rgba(245, 158, 11, 0.3)'
                }}>Touch To Open Indent</span>
              </h2>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                Select your kitchen department below to load its pre-printed material template, or search any ingredient below
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Quick Item Search Combobox */}
              <div style={{ position: 'relative', width: isMobile ? '100%' : '280px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1.5px solid rgba(232, 168, 56, 0.4)',
                  borderRadius: 10,
                  padding: '6px 12px',
                  gap: 8
                }}>
                  <Search size={14} style={{ color: '#e8a838', flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Type 2 letters to search (e.g. 'ba', 'fr', 'pa')..."
                    value={quickSearch}
                    onChange={(e) => setQuickSearch(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: 12,
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                  {quickLoading && <span style={{ fontSize: 10, color: '#e8a838' }}>...</span>}
                </div>

                {/* Instant Search Results Dropdown */}
                {quickResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 6,
                    background: '#0f172a',
                    border: '1.5px solid #e8a838',
                    borderRadius: 10,
                    boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
                    zIndex: 100,
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}>
                    {quickResults.map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setIndentModalItem(item);
                          setQuickSearch('');
                          setQuickResults([]);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderBottom: '1px solid rgba(255,255,255,0.08)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(232, 168, 56, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{item.name}</div>
                          <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                            {item.category} · Stock: <strong style={{ color: '#10b981' }}>{parseFloat(item.remaining || 0)} {item.unit}</strong>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#080c14',
                          background: '#e8a838',
                          padding: '3px 8px',
                          borderRadius: 5,
                          whiteSpace: 'nowrap'
                        }}>
                          + Indent
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Open Full Indent Desk Button */}
              <button
                onClick={() => setCurrentScreen('indent')}
                style={{
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(232, 168, 56, 0.4)',
                  color: '#e8a838',
                  padding: '7px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap'
                }}
              >
                <ClipboardList size={14} /> Full Indent Desk
              </button>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
            gap: isMobile ? 10 : 14,
          }}>
            {activeDepartments.map((dept) => {
              const isHovered = hoveredDept === dept.name;
              return (
                <button
                  key={dept.name}
                  onClick={() => handleOpenDeptIndent(dept.name)}
                  onMouseEnter={() => setHoveredDept(dept.name)}
                  onMouseLeave={() => setHoveredDept(null)}
                  style={{
                    background: isHovered ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)',
                    border: `1.5px solid ${isHovered ? dept.color : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: 14,
                    padding: isMobile ? '12px 10px' : '14px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.18s ease',
                    transform: isHovered ? 'translateY(-2px)' : 'none',
                    boxShadow: isHovered
                      ? `0 8px 20px rgba(0,0,0,0.5), 0 0 15px ${dept.bg}`
                      : '0 2px 8px rgba(0,0,0,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    touchAction: 'manipulation'
                  }}
                >
                  <div style={{
                    fontSize: isMobile ? 22 : 26,
                    width: isMobile ? 40 : 44,
                    height: isMobile ? 40 : 44,
                    borderRadius: 12,
                    background: dept.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {dept.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 2
                    }}>
                      <span style={{
                        fontSize: isMobile ? 12 : 13,
                        fontWeight: 800,
                        color: '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {dept.name}
                      </span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: dept.color,
                        background: dept.bg,
                        padding: '1px 5px',
                        borderRadius: 4,
                        border: `1px solid ${dept.color}40`
                      }}>
                        {dept.code}
                      </span>
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: '#94a3b8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {dept.desc}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 4,
                      gap: 4
                    }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: isHovered ? '#f59e0b' : '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3
                      }}>
                        <span>✓ {getDeptItemCount(dept)} items</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIndentPreFill({ department: dept.name });
                          setCurrentScreen('indent');
                        }}
                        style={{
                          background: 'rgba(232, 168, 56, 0.15)',
                          border: '1px solid rgba(232, 168, 56, 0.35)',
                          color: '#e8a838',
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2
                        }}
                        title={`Open Full Indent Desk for ${dept.name}`}
                      >
                        Desk ↗
                      </button>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Operational Module Cards (Touch-Optimized) */}
        <div style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: isMobile ? 12 : 20,
        }}>
          {visibleModuleCards.map((card) => {
            const isHovered = hoveredCard === card.id;
            return (
              <button
                key={card.id}
                onClick={() => setCurrentScreen(card.id)}
                onMouseEnter={() => setHoveredCard(card.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: `1.5px solid ${isHovered ? card.accentColor : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: 16,
                  padding: isMobile ? '20px 18px' : '26px 22px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: isHovered 
                    ? `0 12px 30px rgba(0, 0, 0, 0.6), 0 0 25px ${card.bgAccent}` 
                    : '0 4px 16px rgba(0, 0, 0, 0.3)',
                  transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  outline: 'none',
                  touchAction: 'manipulation',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Accent glow corner */}
                <div style={{
                  position: 'absolute',
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: card.accentColor,
                  opacity: 0.1,
                  filter: 'blur(20px)'
                }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{
                    width: 50,
                    height: 50,
                    borderRadius: 12,
                    backgroundColor: card.bgAccent,
                    color: card.accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {card.icon}
                  </div>

                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: card.accentColor,
                    background: card.bgAccent,
                    padding: '3px 8px',
                    borderRadius: 6,
                    border: `1px solid ${card.accentColor}33`,
                    textTransform: 'uppercase'
                  }}>
                    {card.badge}
                  </span>
                </div>

                <div>
                  <h2 style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: '#ffffff',
                    margin: '0 0 6px',
                  }}>
                    {card.title}
                  </h2>
                  <p style={{
                    fontSize: 13,
                    color: '#94a3b8',
                    margin: 0,
                    lineHeight: '1.45',
                  }}>
                    {card.description}
                  </p>
                </div>

                <div style={{
                  marginTop: 'auto',
                  paddingTop: 8,
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  color: card.accentColor,
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  Open Station Module <ArrowRight size={14} />
                </div>
              </button>
            );
          })}
        </div>

      </main>

      {/* Flexible Chef Touch Requisition Workspace */}
      {showWorkspace && (
        <ChefRequisitionWorkspace
          defaultDept={workspaceDept}
          onClose={() => setShowWorkspace(false)}
        />
      )}

      {/* Chef Touch Raise Indent Modal for Any Item */}
      {indentModalItem && (
        <RaiseIndentItemModal
          item={indentModalItem}
          isOpen={Boolean(indentModalItem)}
          onClose={() => setIndentModalItem(null)}
          onSuccess={() => setIndentModalItem(null)}
          availableDepartments={activeDepartments}
        />
      )}
    </div>
  );
}
