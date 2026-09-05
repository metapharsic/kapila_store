import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import * as api from '../api';

const MODULE_CARDS = [
  {
    id: 'production_planner',
    icon: '📅',
    title: 'Production Planner',
    description: 'View and manage daily recipes, planning, and kitchen tasks.',
    accentColor: '#8B5CF6', // purple
    bgAccent: '#F5F3FF',
  },
  {
    id: 'indent',
    icon: '📋',
    title: 'Indent Material',
    description: 'Submit material requirements to the store for nightly replenishment.',
    accentColor: '#F59E0B', // amber
    bgAccent: '#FFFBEB',
  },
  {
    id: 'production',
    icon: '👨‍🍳',
    title: 'Daily Production & Waste',
    description: 'Log finished plates, record leftovers, and manage food waste.',
    accentColor: '#10B981', // green
    bgAccent: '#ECFDF5',
  },
];

export default function ChefHome() {
  const { user, logout } = useAuth();
  const { setCurrentScreen } = useAppContext();
  const [hoveredCard, setHoveredCard] = useState(null);

  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Only fetch for the current month
    const d = new Date();
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    const today = d.toISOString().slice(0, 10);

    api.chefStats.overview({ date_from: firstDay, date_to: today })
      .then(res => {
        if (res.success && res.data.length > 0) {
          // Aggregate stats across all departments the chef has access to
          const totalPlates = res.data.reduce((sum, d) => sum + d.total_plates, 0);
          const totalCost = res.data.reduce((sum, d) => sum + d.estimated_cost, 0);
          const totalAnomalies = res.data.reduce((sum, d) => sum + d.total_anomalies, 0);
          const costPerPlate = totalPlates > 0 ? (totalCost / totalPlates).toFixed(2) : '0.00';
          setStats({
            plates: totalPlates,
            costPerPlate,
            anomalies: totalAnomalies
          });
        }
      })
      .catch(console.error);
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F8FAFC',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#1E293B',
        padding: '0 32px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ color: 'white', fontFamily: 'serif', fontSize: '22px', fontStyle: 'italic', fontWeight: 700 }}>
          Kapila
        </div>
        <button
          onClick={logout}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.8)',
            padding: '6px 14px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
          }}
        >
          Sign out
        </button>
      </header>

      {/* Main content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}>

        {/* Greeting */}
        <div style={{ textAlign: 'center', marginBottom: stats ? '40px' : '56px' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#0F172A',
            margin: 0,
            marginBottom: '8px',
            fontFamily: 'var(--font-display, inherit)',
          }}>
            {greeting()}, {user?.name || 'Chef'} 👋
          </h1>
          <p style={{
            fontSize: '15px',
            color: '#64748B',
            margin: 0,
          }}>
            Chef · Hotel Kapila — What would you like to do today?
          </p>
        </div>

        {/* Quick Stats Widget */}
        {stats && (
          <div style={{
            width: '100%',
            maxWidth: '900px',
            background: 'white',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            padding: '24px 32px',
            marginBottom: '40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            flexWrap: 'wrap',
            gap: '24px'
          }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>This Month's Plates</p>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A' }}>{stats.plates}</div>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Cost Per Plate</p>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A' }}>₹{stats.costPerPlate}</div>
            </div>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#64748B', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Anomalies</p>
              <div style={{ fontSize: '28px', fontWeight: 700, color: stats.anomalies > 0 ? '#EF4444' : '#10B981' }}>{stats.anomalies}</div>
            </div>
          </div>
        )}

        {/* Module Cards */}
        <div className="resp-grid-3" style={{
          width: '100%',
          maxWidth: '900px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '24px'
        }}>
          {MODULE_CARDS.map((card) => {
            const isHovered = hoveredCard === card.id;
            return (
              <button
                key={card.id}
                onClick={() => setCurrentScreen(card.id)}
                onMouseEnter={() => setHoveredCard(card.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: 'white',
                  border: `1px solid ${isHovered ? card.accentColor : '#E2E8F0'}`,
                  borderRadius: '16px',
                  padding: '36px 28px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.18s ease',
                  boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.10)' : '0 1px 4px rgba(0,0,0,0.06)',
                  transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  outline: 'none',
                }}
              >
                {/* Icon circle */}
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  backgroundColor: card.bgAccent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '26px',
                }}>
                  {card.icon}
                </div>

                {/* Title */}
                <div>
                  <h2 style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#0F172A',
                    margin: 0,
                    marginBottom: '8px',
                  }}>
                    {card.title}
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: '#64748B',
                    margin: 0,
                    lineHeight: '1.5',
                  }}>
                    {card.description}
                  </p>
                </div>

                {/* Arrow */}
                <div style={{
                  marginTop: 'auto',
                  color: card.accentColor,
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  Open →
                </div>
              </button>
            );
          })}
        </div>

      </main>
    </div>
  );
}
