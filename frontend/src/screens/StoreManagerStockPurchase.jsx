import { useState, useEffect } from "react";
import Card from "../components/Card";
import { COLORS } from "../styles/colors";
import * as api from "../api";
import { useAppContext } from "../context/AppContext";
import { today } from "../utils/dates";
import { ChevronLeft, ShoppingCart, TrendingUp, Package, Clock, X, Receipt, Activity } from "lucide-react";
import { useBreakpoint } from "../styles/responsive";

import { NewStockEntryForm } from "../components/StockMaster/NewStockEntryForm";
import { poStatusStyle } from "../utils/poStatus";

export default function StoreManagerStockPurchase() {
  const { stocks, refreshStockNames, setCurrentScreen } = useAppContext();
  const { isMobile } = useBreakpoint();

  const [ledgerData, setLedgerData]       = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // POs
  const [recentPos, setRecentPos] = useState([]);
  const [viewPoId, setViewPoId] = useState(null);
  const [poDetails, setPoDetails] = useState(null);
  const [poLoading, setPoLoading] = useState(false);

  // KPIs
  const [purchasesToday, setPurchasesToday] = useState(0);
  const [recentDeliveries, setRecentDeliveries] = useState(0);

  const loadLedger = async () => {
    setLedgerLoading(true);
    try {
      const [resLedger, resPo] = await Promise.all([
        api.stock.ledger({ page: 1, limit: 100 }),
        api.purchaseOrders.list({ page: 1, limit: 10 })
      ]);
      const data = resLedger.data || [];
      setLedgerData(data);
      setRecentPos(resPo.data || []);

      const purchases = data.filter(item => item.type === "Purchase");
      
      // Calculate KPIs
      const tDate = today();
      const pToday = purchases.filter(p => (p.date || "").startsWith(tDate)).length;
      
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const rDeliveries = purchases.filter(p => new Date(p.date) >= sevenDaysAgo).length;

      setPurchasesToday(pToday);
      setRecentDeliveries(rDeliveries);

    } catch (e) {
      console.error("Failed to load ledger/POs:", e);
    } finally {
      setLedgerLoading(false);
    }
  };

  const openPoDetails = async (id) => {
    setViewPoId(id);
    setPoLoading(true);
    setPoDetails(null);
    try {
      const res = await api.purchaseOrders.getOne(id);
      setPoDetails(res.data);
    } catch (e) {
      console.error("Failed to load PO details", e);
    } finally {
      setPoLoading(false);
    }
  };

  useEffect(() => { loadLedger(); refreshStockNames(); }, []);

  const purchases = ledgerData.filter((item) => item.type === "Purchase");

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#F8FAFC",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* ── Page Header (Dashboard Style) ── */}
      <header style={{
        backgroundColor: '#1E293B',
        padding: '0 32px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setCurrentScreen('store_manager_home')}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.8)',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
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
            <ChevronLeft size={16} /> Back to Dashboard
          </button>
          <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' }} />
          <h1 style={{ color: 'white', fontSize: '18px', fontWeight: 600, margin: 0 }}>
            Receive Stock
          </h1>
          <button
            onClick={() => setCurrentScreen('pos')}
            style={{
              marginLeft: 'auto', background: 'none', border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.85)', padding: '6px 12px', borderRadius: '6px',
              cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            }}
          >
            View All Purchase Orders →
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 24px',
        overflowY: 'auto'
      }}>
        <div style={{ width: '100%', maxWidth: '1400px' }}>
          
          {/* Greeting / Title Area */}
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#0F172A',
              margin: 0,
              marginBottom: '8px',
            }}>
              Record New Stock
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Scan supplier receipts or manually enter stock deliveries below.
            </p>
          </div>

          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: `4px solid #10B981` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '14px', fontWeight: 600 }}>
                <TrendingUp size={16} color="#10B981" /> Purchases Today
              </div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#0F172A' }}>
                {ledgerLoading ? '-' : purchasesToday}
              </div>
            </Card>

            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: `4px solid #3B82F6` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '14px', fontWeight: 600 }}>
                <Package size={16} color="#3B82F6" /> Total Catalog Items
              </div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#0F172A' }}>
                {stocks ? stocks.length : '-'}
              </div>
            </Card>

            <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: `4px solid #F59E0B` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B', fontSize: '14px', fontWeight: 600 }}>
                <ShoppingCart size={16} color="#F59E0B" /> Recent Deliveries (7d)
              </div>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#0F172A' }}>
                {ledgerLoading ? '-' : recentDeliveries}
              </div>
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 2fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
            
            {/* Left Col: Entry Form */}
            <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px 0', color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={18} color="#10B981" /> Entry Form
              </h3>
              <NewStockEntryForm onSuccess={() => { loadLedger(); refreshStockNames(); }} />
            </Card>

            {/* Right Col: Feed */}
            <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 20px 0', color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="#3B82F6" /> Recent Purchases
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {ledgerLoading ? (
                  <div style={{ fontSize: '13px', color: '#94A3B8' }}>Loading recent purchases...</div>
                ) : purchases.length === 0 ? (
                  <div style={{ fontSize: '13px', color: '#94A3B8' }}>No purchases recorded yet. Add your first stock entry.</div>
                ) : (
                  purchases.slice(0, 10).map((p, index) => (
                    <div key={p.item_code || index} style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "12px", borderRadius: 12,
                      background: "#F8FAFC", border: "1px solid #E2E8F0",
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#10B98118", color: "#10B981", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <ShoppingCart size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.name}
                          </p>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", flexShrink: 0 }}>
                            {p.qty} {p.unit}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "#64748B", display: "flex", justifyContent: "space-between" }}>
                          <span>{new Date(p.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}</span>
                          <span style={{ fontStyle: 'italic' }}>{p.detail || "Supplier: Unknown"}</span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

          </div>
        </div>
      </main>

      {/* PO Details Modal */}
      {viewPoId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Card style={{ maxWidth: 700, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", borderRadius: 16 }}>
            {/* Modal Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC" }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 18, color: "#0F172A" }}>
                <Receipt size={20} color="#3B82F6" /> Purchase Order Details
              </h3>
              <button onClick={() => setViewPoId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}>
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>
              {poLoading ? (
                <div style={{ textAlign: "center", padding: 48, color: "#64748B" }}>
                  <Activity size={24} className="spin" style={{ margin: "0 auto 12px", color: "#3B82F6", display: "block" }} />
                  Loading invoice details...
                </div>
              ) : !poDetails ? (
                <p style={{ textAlign: "center", color: "#EF4444", padding: 24 }}>Failed to load PO details.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  
                  {/* PO Info Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", padding: 16, borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>PO Number</p>
                      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: "#0F172A", fontFamily: "monospace" }}>{poDetails.po_number}</p>
                    </div>
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", padding: 16, borderRadius: 8 }}>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>Total Amount</p>
                      <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: "#0F172A" }}>₹{parseFloat(poDetails.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 32 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontWeight: 600 }}>PO Date</p>
                      <p style={{ margin: "4px 0 0", fontSize: 14, color: "#0F172A", fontWeight: 500 }}>{poDetails.date}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontWeight: 600 }}>Status</p>
                      <span style={{
                        display: "inline-block", marginTop: 4,
                        background: poStatusStyle(poDetails.status).bg,
                        color: poStatusStyle(poDetails.status).text,
                        fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 12
                      }}>
                        {poDetails.status}
                      </span>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontWeight: 600 }}>Supplier</p>
                      <p style={{ margin: "4px 0 0", fontSize: 14, color: "#0F172A", fontWeight: 500 }}>{poDetails.supplier_name}</p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div>
                    <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#0F172A", fontWeight: 700 }}>Order Items</h4>
                    <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                        <thead>
                          <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                            <th style={{ padding: "10px 16px", textAlign: "left", color: "#64748B", fontWeight: 600 }}>Item Code</th>
                            <th style={{ padding: "10px 16px", textAlign: "left", color: "#64748B", fontWeight: 600 }}>Item</th>
                            <th style={{ padding: "10px 16px", textAlign: "left", color: "#64748B", fontWeight: 600 }}>Qty</th>
                            <th style={{ padding: "10px 16px", textAlign: "right", color: "#64748B", fontWeight: 600 }}>Unit Price</th>
                            <th style={{ padding: "10px 16px", textAlign: "right", color: "#64748B", fontWeight: 600 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(poDetails.items || []).map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "10px 16px", color: "#3B82F6", fontSize: 12, fontWeight: 600 }}>{it.item_code || "—"}</td>
                              <td style={{ padding: "10px 16px", color: "#0F172A", fontWeight: 500 }}>{it.name}</td>
                              <td style={{ padding: "10px 16px", color: "#475569" }}>{it.qty} <span style={{ fontSize: 12 }}>{it.unit}</span></td>
                              <td style={{ padding: "10px 16px", textAlign: "right", color: "#475569" }}>₹{parseFloat(it.price).toFixed(2)}</td>
                              <td style={{ padding: "10px 16px", textAlign: "right", color: "#0F172A", fontWeight: 600 }}>₹{(parseFloat(it.qty) * parseFloat(it.price)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* Modal Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "flex-end" }}>
              <button 
                onClick={() => setViewPoId(null)}
                style={{ background: "#FFFFFF", border: "1px solid #CBD5E1", padding: "8px 16px", borderRadius: 8, fontWeight: 600, color: "#475569", cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </Card>
        </div>
      )}    </div>
  );
}
