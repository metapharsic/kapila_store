import React, { useState, useEffect, useMemo } from "react";
import kapilaLogo from "./assets/kapila-logo.png";
import { COLORS } from "./styles/colors";
import "./styles/global.css";
import { AppProvider, useAppContext } from "./context/AppContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedScreen from "./components/ProtectedScreen";
import SidebarOmniSearch from "./components/SidebarOmniSearch";
import { 
  LayoutDashboard, Package, Factory, Building2, Receipt, Inbox, Bell, 
  Scale, ArrowLeftRight, CalendarRange, ClipboardList, Send, ChefHat, 
  ArchiveRestore, Trash2, Search, Users, ShieldCheck, LogOut, BarChart3,
  CalendarCheck, ClipboardCheck, Wrench, Truck, Shield, GitPullRequest,
  Sun, Moon
} from "lucide-react";

import ErrorBoundary from "./components/ErrorBoundary";


import Dashboard      from "./screens/Dashboard";
import StockScreen    from "./screens/Stock";
import IndentScreen   from "./screens/Indent";
import IssuanceScreen from "./screens/Issuance";
import ProductionScreen from "./screens/Production";
import SuppliersScreen      from "./screens/Suppliers";
import DepartmentsScreen    from "./screens/Departments";
import PurchaseOrdersScreen  from "./screens/PurchaseOrders";
import GoodsReceiptScreen    from "./screens/GoodsReceipt";
import ReconciliationScreen  from "./screens/Reconciliation";
import TransfersScreen       from "./screens/Transfers";
import ReorderPointsScreen   from "./screens/ReorderPoints";
import ChefStatsScreen        from "./screens/ChefStats";
import UserManagementScreen from "./screens/UserManagement";
import AuditLogsScreen from "./screens/AuditLogs";
import LoginScreen from "./screens/Login";
import ProductionPlannerScreen from "./screens/ProductionPlanner";
import AuditScreen from "./screens/audit/AuditScreen";
import ApprovalsScreen from "./screens/Approvals";
import MaintenanceScreen from "./screens/Maintenance";
import GateAndUtilitiesScreen from "./screens/GateAndUtilities";
import FoodSafetyAndWasteScreen from "./screens/FoodSafetyAndWaste";
import StaffAndNightAuditScreen from "./screens/StaffAndNightAudit";
import SystemConfigScreen from "./screens/SystemConfig";
import InboundDCScreen from "./screens/InboundDC";
import ReturnableAssetTracker from "./screens/GateAndUtilities/ReturnableAssetTracker";


import StoreManagerHome from "./screens/StoreManagerHome";
import StoreManagerStockPurchase from "./screens/StoreManagerStockPurchase";
import ChefHome from "./screens/ChefHome";
import PowerBiDashboard from "./screens/Reports/PowerBiDashboard";
import NotificationPanel from "./components/NotificationPanel";
import ModularExtensionsModal from "./components/extensions/ModularExtensionsModal";
import DormantScreenNotice from "./components/extensions/DormantScreenNotice";

const NAV_CATEGORIES = [
  {
    title: "General",
    items: [
      { id: "dashboard",    label: "Dashboard",       permission: "dashboard.view", icon: <LayoutDashboard size={16} /> },
      { id: "reports",      label: "BI Reports",      permission: "dashboard.view", icon: <BarChart3 size={16} /> },
    ]
  },
  {
    title: "Master Data",
    items: [
      { id: "stock",        label: "Stock Master",    permission: "stock.view", icon: <Package size={16} /> },
      { id: "audit",        label: "Stock Audit",     permission: "audit.view", icon: <ClipboardCheck size={16} /> },
    ]
  },
  {
    title: "Procurement",
    items: [
      { id: "pos",          label: "Purchase Orders", permission: "purchase_orders.view", icon: <Receipt size={16} /> },
      { id: "inbound_dc",   label: "Inbound Challans (DC)", permission: "inbound_dc.view", icon: <Truck size={16} /> },
      { id: "grn",          label: "Goods Receipt",   permission: "grn.view", icon: <Inbox size={16} /> },
      { id: "reorder",      label: "Reorder Points",  permission: "reorder_points.view", icon: <Bell size={16} /> },
      { id: "approvals",    label: "Approval Queue",  permission: "purchase_orders.approve", icon: <ClipboardCheck size={16} /> },
    ]
  },
  {
    title: "Store Operations",
    items: [
      { id: "indent",       label: "Indent Requests", permission: "indents.view",     icon: <ClipboardList size={16} /> },
      { id: "issuance",     label: "Store Issuance",  permission: "issuances.create", icon: <Send size={16} /> },
      { id: "reconcile",    label: "Reconciliation",  permission: "reconciliation.view", icon: <Scale size={16} /> },
      { id: "transfers",    label: "Stock Transfers", permission: "transfers.view",   icon: <ArrowLeftRight size={16} /> },
    ]
  },
  {
    title: "Kitchen & Assets",
    items: [
      { id: "production_planner", label: "Production Planner", permission: "recipes.view", icon: <CalendarCheck size={16} /> },
      { id: "production",   label: "Daily Production & Waste", permission: "users.manage_roles", icon: <ChefHat size={16} /> },
      { id: "maintenance",  label: "Kitchen Asset CMMS", permission: "maintenance.view", icon: <Wrench size={16} /> },
      { id: "gate_utilities", label: "Gate & Utilities", permission: ["security.view", "utility.view"], icon: <Truck size={16} /> },
      { id: "returnable_assets", label: "Returnable Assets (RGP)", permission: "security.view", icon: <ShieldCheck size={16} /> },
      { id: "staff_audit",   label: "Staff & Night Audit", permission: ["staff.view", "night_audit.view"], icon: <Users size={16} /> },
      { id: "chef_stats",    label: "Chef Statistics",  permission: "chef_stats.view", icon: <BarChart3 size={16} /> },
    ]
  },
  {
    title: "Administration",
    items: [
      { id: "suppliers",     label: "Suppliers Master", permission: "suppliers.view", icon: <Factory size={16} /> },
      { id: "departments",   label: "Departments",     permission: "departments.view", icon: <Building2 size={16} /> },
      { id: "users",         label: "User Management", permission: "users.view", icon: <Users size={16} /> },
      { id: "audit_logs",    label: "Audit Logs",      permission: "audit_logs.view", icon: <ShieldCheck size={16} /> },
      { id: "system_config", label: "System Config & Sync", permission: "users.view", icon: <GitPullRequest size={16} /> },
    ]
  }
];

const STORE_MANAGER_NAV_CATEGORIES = [
  {
    title: "Store Operations",
    items: [
      { id: "store_manager_home",            label: "Home",             permission: "stock.view",        icon: <LayoutDashboard size={16} /> },
      { id: "store_manager_available_stock", label: "Available Stock",  permission: "stock.view",        icon: <Package size={16} /> },
      { id: "store_manager_stock_purchase",  label: "Receive Stock",    permission: "stock.create",      icon: <Receipt size={16} /> },
      { id: "store_manager_store_issuance",  label: "Store Issuance",   permission: "issuances.create",  icon: <Send size={16} /> },
      { id: "store_manager_indent",          label: "Indent Request",   permission: "indents.view",      icon: <ClipboardList size={16} /> },
    ]
  },
  {
    title: "Procurement & Inward",
    items: [
      { id: "pos",                            label: "Purchase Orders",     permission: "purchase_orders.view", icon: <Receipt size={16} /> },
      { id: "grn",                            label: "Goods Receipt (GRN)", permission: "grn.view",             icon: <Inbox size={16} /> },
      { id: "suppliers",                      label: "Vendors & Suppliers", permission: "suppliers.view",       icon: <Factory size={16} /> },
      { id: "reorder",                        label: "Reorder Points",      permission: "reorder_points.view",   icon: <Bell size={16} /> },
      { id: "approvals",                      label: "Approval Queue",      permission: "purchase_orders.approve", icon: <ClipboardCheck size={16} /> },
    ]
  },
  {
    title: "Inventory & Assets",
    items: [
      { id: "audit",                          label: "Stock Audit",         permission: "audit.view",           icon: <ClipboardCheck size={16} /> },
      { id: "reconcile",                      label: "Reconciliation",      permission: "reconciliation.view",   icon: <Scale size={16} /> },
      { id: "transfers",                      label: "Stock Transfers",     permission: "transfers.view",       icon: <ArrowLeftRight size={16} /> },
      { id: "maintenance",                    label: "Kitchen Asset CMMS",  permission: "maintenance.view",     icon: <Wrench size={16} /> },
      { id: "gate_utilities",                 label: "Gate & Utilities",    permission: ["security.view", "utility.view"], icon: <Truck size={16} /> },
      { id: "staff_audit",                    label: "Staff & Night Audit", permission: ["staff.view", "night_audit.view"], icon: <Users size={16} /> },
    ]
  }
];

const SCREEN_PERMISSIONS = Object.fromEntries([
  ...NAV_CATEGORIES.flatMap((cat) => cat.items.map((item) => [item.id, item.permission])),
  ...STORE_MANAGER_NAV_CATEGORIES.flatMap((cat) => cat.items.map((item) => [item.id, item.permission])),
]);

const SIDEBAR_WIDTH = 230;

function Inner() {
  const { currentScreen: screen, setCurrentScreen: setScreen, refreshStockNames, refreshReorderAlerts, reorderAlerts = [], modularExtensions = {}, toggleModularExtension } = useAppContext();
  const { user, roles, loading, isAuthenticated, hasPermission, hasAnyPermission, logout } = useAuth();
  const [showExtensionsModal, setShowExtensionsModal] = useState(false);

  const screenHasPermission = (screenId) => {
    const perm = SCREEN_PERMISSIONS[screenId];
    if (!perm) return false;
    return Array.isArray(perm) ? hasAnyPermission(perm) : hasPermission(perm);
  };
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("kapila_theme") || "light");

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("theme-dark");
      document.body.classList.add("theme-dark");
    } else {
      document.documentElement.classList.remove("theme-dark");
      document.body.classList.remove("theme-dark");
    }
    localStorage.setItem("kapila_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  const lowStockCount = reorderAlerts.length;

  const itemHasPermission = (item) => {
    if (Array.isArray(item.permission)) {
      return hasAnyPermission(item.permission);
    }
    return hasPermission(item.permission);
  };

  const isModularExtensionVisible = (item) => {
    if (item.id === "maintenance" && !modularExtensions.maintenance) return false;
    if (item.id === "staff_audit" && !modularExtensions.staff_audit) return false;
    return true;
  };

  const dormantExtensionsCount = ["maintenance", "staff_audit"].filter((k) => !modularExtensions[k]).length;

  const isStoreManager = roles.some((role) => role.key === "store_manager");
  const isChef         = roles.some((role) => role.key === "chef");

  const activeNavSource = isStoreManager ? STORE_MANAGER_NAV_CATEGORIES : NAV_CATEGORIES;
  const visibleNavCategories = activeNavSource
    .map((cat) => ({ 
      ...cat, 
      items: cat.items.filter((item) => itemHasPermission(item) && isModularExtensionVisible(item)) 
    }))
    .filter((cat) => cat.items.length > 0);
  const visibleNavItems = visibleNavCategories.flatMap((cat) => cat.items);

  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");

  const filteredNavCategories = useMemo(() => {
    const q = sidebarSearchQuery.trim().toLowerCase();
    if (q.length < 2) return visibleNavCategories;
    return visibleNavCategories
      .map((cat) => {
        const catMatches = cat.title.toLowerCase().includes(q);
        const matchingItems = cat.items.filter((item) =>
          catMatches || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
        );
        return { ...cat, items: matchingItems };
      })
      .filter((cat) => cat.items.length > 0);
  }, [visibleNavCategories, sidebarSearchQuery]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshStockNames();
      refreshReorderAlerts();
    }
  }, [isAuthenticated, refreshStockNames, refreshReorderAlerts]);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      if (isChef) {
        if (!screenHasPermission(screen)) {
          setScreen("chef_home");
        }
      } else if (isStoreManager) {
        // SM must stay on a store_manager_ screen OR one of their own nav items
        // (e.g. "pos" — the shared Purchase Orders screen, same window as
        // admin) that the role can actually access via permission.
        const allowedIds = visibleNavItems.map((item) => item.id);
        if ((!(screen.startsWith("store_manager_") || allowedIds.includes(screen)) || !screenHasPermission(screen)) && visibleNavItems.length) {
          setScreen(visibleNavItems[0].id);
        }
      } else if (visibleNavItems.length && !screenHasPermission(screen)) {
        setScreen(visibleNavItems[0].id);
      }
    }
  }, [loading, isAuthenticated, isStoreManager, isChef, visibleNavItems, screen, hasPermission, hasAnyPermission, setScreen, roles]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const screens = {
    dashboard:  <ProtectedScreen permission="dashboard.view"><Dashboard /></ProtectedScreen>,
    reports:    <ProtectedScreen permission="dashboard.view"><PowerBiDashboard /></ProtectedScreen>,
    stock:      <ProtectedScreen permission="stock.view"><StockScreen /></ProtectedScreen>,
    suppliers:  <ProtectedScreen permission="suppliers.view"><SuppliersScreen /></ProtectedScreen>,
    departments: <ProtectedScreen permission="departments.view"><DepartmentsScreen /></ProtectedScreen>,
    pos:        <ProtectedScreen permission="purchase_orders.view"><PurchaseOrdersScreen /></ProtectedScreen>,
    inbound_dc: <ProtectedScreen permission="inbound_dc.view"><InboundDCScreen /></ProtectedScreen>,
    grn:        <ProtectedScreen permission="grn.view"><GoodsReceiptScreen /></ProtectedScreen>,
    reorder:    <ProtectedScreen permission="reorder_points.view"><ReorderPointsScreen /></ProtectedScreen>,
    reconcile:  <ProtectedScreen permission="reconciliation.view"><ReconciliationScreen /></ProtectedScreen>,
    transfers:  <ProtectedScreen permission="transfers.view"><TransfersScreen /></ProtectedScreen>,
    approvals:  <ProtectedScreen permission="purchase_orders.approve"><ApprovalsScreen /></ProtectedScreen>,
    indent:     <ProtectedScreen permission="indents.view"><IndentScreen /></ProtectedScreen>,
    issuance:   <ProtectedScreen permission="issuances.create"><IssuanceScreen /></ProtectedScreen>,

    production: (
      <ProtectedScreen permission="users.manage_roles">
        <ProductionScreen />
      </ProtectedScreen>
    ),
    production_planner: <ProtectedScreen permission="recipes.view"><ProductionPlannerScreen /></ProtectedScreen>,
    chef_stats: <ProtectedScreen permission="chef_stats.view"><ChefStatsScreen /></ProtectedScreen>,
    users: <ProtectedScreen permission="users.view"><UserManagementScreen /></ProtectedScreen>,
    audit_logs: <ProtectedScreen permission="audit_logs.view"><AuditLogsScreen /></ProtectedScreen>,
    audit: <ProtectedScreen permission="audit.view"><AuditScreen /></ProtectedScreen>,
    
    store_manager_home: <ProtectedScreen permission="stock.view"><StoreManagerHome /></ProtectedScreen>,
    store_manager_available_stock: <ProtectedScreen permission="stock.view"><StockScreen /></ProtectedScreen>,
    store_manager_stock_purchase: <ProtectedScreen permission="stock.create"><StoreManagerStockPurchase /></ProtectedScreen>,
    store_manager_store_issuance: <ProtectedScreen permission="issuances.create"><IssuanceScreen /></ProtectedScreen>,
    store_manager_indent: <ProtectedScreen permission="indents.view"><IndentScreen /></ProtectedScreen>,
    
    chef_home: <ProtectedScreen permission={["recipes.view", "indents.view", "chef_stats.view"]}><ChefHome /></ProtectedScreen>,
    maintenance: !modularExtensions.maintenance ? (
      <DormantScreenNotice moduleKey="maintenance" onEnable={() => toggleModularExtension("maintenance", true)} />
    ) : (
      <ProtectedScreen permission="maintenance.view"><MaintenanceScreen /></ProtectedScreen>
    ),
    gate_utilities: <ProtectedScreen permission={["security.view", "utility.view"]}><GateAndUtilitiesScreen /></ProtectedScreen>,
    returnable_assets: <ProtectedScreen permission="security.view"><ReturnableAssetTracker /></ProtectedScreen>,
    staff_audit: !modularExtensions.staff_audit ? (
      <DormantScreenNotice moduleKey="staff_audit" onEnable={() => toggleModularExtension("staff_audit", true)} />
    ) : (
      <ProtectedScreen permission={["staff.view", "night_audit.view"]}><StaffAndNightAuditScreen /></ProtectedScreen>
    ),
    system_config: <ProtectedScreen permission="users.view"><SystemConfigScreen /></ProtectedScreen>,
  };

  const handleNavigation = (id) => {
    setScreen(id);
    if (isMobile) setIsSidebarOpen(false);
  };

  const activeNavItem = visibleNavItems.find(n => n.id === screen);
  const primaryRole = roles[0]?.name || "User";

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: COLORS.bg, gap: 16 }}>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
        <div style={{
          width: 40, height: 40,
          border: `3px solid ${COLORS.border}`,
          borderTopColor: COLORS.brand,
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <p style={{ color: COLORS.muted, fontSize: 14, fontWeight: 500 }}>Initializing Kapila IMS...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <LoginScreen />
      </ErrorBoundary>
    );
  }

  const showSidebar = !isChef;

  return (
    <>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", backgroundColor: "var(--bg-page)" }}>
        
        {/* Mobile Overlay */}
        {isMobile && isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)}
            style={{
              position: "fixed", inset: 0,
              backgroundColor: "rgba(0,0,0,0.5)", zIndex: 99,
              backdropFilter: "blur(2px)"
            }}
          />
        )}

        {/* ═══ SIDEBAR ═══ */}
        {showSidebar && (
          <aside style={{
            width: SIDEBAR_WIDTH,
            background: "var(--bg-sidebar)",
            borderRight: "1px solid var(--sidebar-border)",
            boxShadow: "var(--shadow-sidebar)",
            display: "flex",
            flexDirection: "column",
            position: isMobile ? "fixed" : "relative",
            top: 0, bottom: 0, left: 0,
            transform: isMobile ? (isSidebarOpen ? "translateX(0)" : `translateX(-${SIDEBAR_WIDTH}px)`) : "none",
            transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
            zIndex: 100,
            flexShrink: 0,
            overflow: "visible",
            scrollbarWidth: "thin"
          }}>
          {/* Logo */}
          <div style={{
            display: "flex", alignItems: "center",
            padding: "14px 16px", borderBottom: "1px solid var(--sidebar-border)",
            flexShrink: 0
          }}>
            <div 
              onClick={() => {
                if (isStoreManager) setScreen("store_manager_home");
                else if (isChef) setScreen("chef_home");
                else setScreen("dashboard");
                if (isMobile) setIsSidebarOpen(false);
              }}
              style={{
              backgroundColor: "#1E293B", borderRadius: 8,
              padding: "8px 14px",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "100%",
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
              cursor: "pointer",
              border: "1px solid rgba(232,168,56,0.2)"
            }}>
              <img
                src={kapilaLogo}
                alt="Kapila IMS"
                style={{ height: 28, width: "auto", display: "block", objectFit: "contain" }}
              />
            </div>
          </div>

          {/* User Profile */}
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--sidebar-border)" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--color-gold-dim)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--color-gold)" }} title={user?.name}>
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-sidebar)" }}>{user?.name || "Kapila User"}</div>
              <div style={{ fontSize: 11, color: "var(--sidebar-category)" }}>{primaryRole}</div>
            </div>
          </div>

          {/* ═══ Multi-Agent OmniSearch (2-Letter Item & Page Search Bar) ═══ */}
          <SidebarOmniSearch
            categories={visibleNavCategories}
            onNavigate={(screenId) => {
              handleNavigation(screenId);
            }}
            onQueryChange={setSidebarSearchQuery}
            isMobile={isMobile}
            onCloseMobile={() => {
              if (isMobile) setIsSidebarOpen(false);
            }}
          />

          {/* Nav */}
          <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", scrollbarWidth: "none" }}>
            {filteredNavCategories.length === 0 ? (
              <div style={{ padding: "16px 12px", textAlign: "center", fontSize: 12, color: "var(--sidebar-category)" }}>
                No pages match "{sidebarSearchQuery}"
                <div style={{ marginTop: 4, color: "var(--color-gold)", fontSize: 11 }}>
                  Showing items in OmniSearch popover →
                </div>
              </div>
            ) : (
              filteredNavCategories.map((cat) => (
              <div key={cat.title} style={{ marginBottom: 4 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: "var(--sidebar-category)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  padding: "8px 12px 4px", userSelect: "none"
                }}>
                  {cat.title}
                </div>
                {cat.items.map((n) => {
                  const isActive = screen === n.id;
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNavigation(n.id)}
                      title={n.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: 8,
                        background: isActive ? "var(--sidebar-active-bg)" : "transparent",
                        color: isActive ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
                        border: "none",
                        transition: "all 0.15s",
                        textAlign: "left",
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 400,
                        cursor: "pointer",
                        position: "relative"
                      }}
                      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "var(--sidebar-hover-bg)"; e.currentTarget.style.color = "var(--sidebar-text-hover)"; } }}
                      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--sidebar-text)"; } }}
                    >
                      <span style={{ 
                        color: isActive ? "var(--sidebar-active-text)" : "var(--sidebar-text)",
                        display: "flex", flexShrink: 0
                      }}>
                        {React.isValidElement(n.icon)
                          ? n.icon
                          : typeof n.icon === "function" || (typeof n.icon === "object" && n.icon !== null && n.icon.$$typeof)
                          ? React.createElement(n.icon, { size: 16 })
                          : n.icon}
                      </span>
                      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {n.label}
                      </span>
                      {n.id === "reorder" && lowStockCount > 0 && (
                        <span style={{
                          background: COLORS.danger,
                          color: "#fff",
                          fontSize: 9,
                          fontWeight: 700,
                          minWidth: 16, height: 16,
                          padding: "0 4px",
                          borderRadius: 8,
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                          {lowStockCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )))}
          </nav>

          {/* ═══ Modular Extensions Indicator & Quick-Toggle Button ═══ */}
          <div 
            onClick={() => setShowExtensionsModal(true)}
            style={{
              margin: "6px 10px 8px",
              padding: "8px 10px",
              borderRadius: 8,
              background: dormantExtensionsCount > 0 
                ? "linear-gradient(90deg, rgba(232, 168, 56, 0.12) 0%, rgba(232, 168, 56, 0.04) 100%)" 
                : "rgba(16, 185, 129, 0.08)",
              border: `1px solid ${dormantExtensionsCount > 0 ? "rgba(232, 168, 56, 0.35)" : "rgba(16, 185, 129, 0.25)"}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)"
            }}
            title="Configure Commercial Kitchen CMMS & Staff HRMS / Night Audit"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, overflow: "hidden" }}>
              <span style={{ fontSize: 13, color: dormantExtensionsCount > 0 ? COLORS.accent : "#10b981" }}>⚡</span>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-sidebar)", whiteSpace: "nowrap" }}>
                  Modular Extensions
                </span>
                <span style={{ fontSize: 9.5, color: "var(--sidebar-category)", whiteSpace: "nowrap" }}>
                  {dormantExtensionsCount > 0 ? `${dormantExtensionsCount} Dormant (CMMS / HR)` : "All Active ✓"}
                </span>
              </div>
            </div>
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 8,
              background: dormantExtensionsCount > 0 ? "rgba(232, 168, 56, 0.2)" : "rgba(16, 185, 129, 0.2)",
              color: dormantExtensionsCount > 0 ? COLORS.accent : "#10b981"
            }}>
              {dormantExtensionsCount > 0 ? "ENABLE" : "ON"}
            </span>
          </div>

          {/* Footer */}
          <div style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--sidebar-border)",
            display: "flex", alignItems: "center", gap: 8,
            flexShrink: 0
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "#10B981"
            }} className="pulse" />
            <span style={{ fontSize: 11, color: "var(--sidebar-category)", fontWeight: 500 }}>PostgreSQL · Live v1.0.0</span>
          </div>
        </aside>
        )}

        {/* ═══ MAIN AREA ═══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          
          {/* Top Bar */}
          {showSidebar && (
            <header style={{
              height: 52,
              display: "flex", alignItems: "center",
              padding: isMobile ? "0 16px" : "0 24px",
              background: COLORS.surface,
              borderBottom: `1px solid ${COLORS.border}`,
              gap: 12,
              flexShrink: 0,
              zIndex: 10
            }}>
              {isMobile && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open sidebar"
                  style={{ background: "none", border: "none", fontSize: 20, color: COLORS.text, cursor: "pointer", display: "flex", padding: 4 }}
                >
                  ☰
                </button>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.muted }}>
                <span style={{ fontWeight: 600, color: COLORS.text }}>
                  {activeNavItem?.label || "Dashboard"}
                </span>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                {/* Header Modular Extensions Indicator Button */}
                <button
                  onClick={() => setShowExtensionsModal(true)}
                  title="Configure Modular Extensions (CMMS & Staff HRMS)"
                  style={{
                    background: dormantExtensionsCount > 0 ? "rgba(232, 168, 56, 0.12)" : "rgba(255, 255, 255, 0.04)",
                    border: `1px solid ${dormantExtensionsCount > 0 ? "rgba(232, 168, 56, 0.4)" : COLORS.border}`,
                    borderRadius: 20,
                    padding: "4px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: "pointer",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: dormantExtensionsCount > 0 ? COLORS.accent : COLORS.muted,
                    transition: "all 0.15s"
                  }}
                >
                  <span>⚡</span>
                  <span style={{ display: isMobile ? "none" : "inline" }}>Extensions</span>
                  {dormantExtensionsCount > 0 && (
                    <span style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      background: COLORS.accent,
                      color: "#161922",
                      padding: "0 6px",
                      borderRadius: 10
                    }}>
                      {dormantExtensionsCount} Dormant
                    </span>
                  )}
                </button>

                <NotificationPanel user={user} />
                <button onClick={toggleTheme} title="Toggle Touch Panel Color Mode" aria-label="Toggle Theme" style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, display: "grid", placeItems: "center", cursor: "pointer" }}>
                  {theme === "dark" ? <Sun size={15} color={COLORS.muted} /> : <Moon size={15} color={COLORS.muted} />}
                </button>
                <button onClick={logout} title="Logout" aria-label="Logout" style={{ width: 32, height: 32, borderRadius: "50%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <LogOut size={15} color={COLORS.muted} />
                </button>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: COLORS.brand + "20",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 600, color: COLORS.brand, fontSize: 13
                }} title={user?.name}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
              </div>
            </header>
          )}

          {/* Scrollable Content */}
          <main style={{
            flex: 1,
            overflowY: "auto",
            padding: isMobile ? "12px 16px" : "20px 24px",
            backgroundColor: COLORS.bg,
            position: "relative"
          }}>
            {/* Ambient Hotel Kapila Brand Watermark */}
            <div
              className="kapila-app-watermark"
              aria-hidden="true"
              style={{
                left: showSidebar && !isMobile ? `calc(50% + ${SIDEBAR_WIDTH / 2}px)` : "50%",
              }}
            >
              <img src={kapilaLogo} alt="" />
            </div>

            <div style={{ position: "relative", zIndex: 1 }}>
              <ErrorBoundary>
                {screens[screen]}
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      {/* Modular Extensions Interactive Modal */}
      <ModularExtensionsModal
        isOpen={showExtensionsModal}
        onClose={() => setShowExtensionsModal(false)}
      />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <Inner />
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
