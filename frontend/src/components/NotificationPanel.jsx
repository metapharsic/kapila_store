import React, { useState, useEffect, useRef } from "react";
import { COLORS } from "../styles/colors";
import { Bell, Check, Eye, AlertTriangle, AlertCircle, Info, ShieldAlert } from "lucide-react";
import * as api from "../api";
import Btn from "./Btn";
import { useAppContext } from "../context/AppContext";

export default function NotificationPanel({ user }) {
  const { setCurrentScreen } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.notifications.list();
      if (res.success && Array.isArray(res.data)) {
        setNotifications(res.data);
        setUnreadCount(res.data.filter(n => !n.is_read).length);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (id) => {
    try {
      const res = await api.notifications.markRead(id);
      if (res.success) {
        setNotifications(prev =>
          prev.map(n => (id === "all" || n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount(id === "all" ? 0 : Math.max(0, unreadCount - 1));
      }
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const handleNotificationClick = (item) => {
    const typeStr = (item.type || "").toLowerCase();
    const textStr = ((item.title || "") + " " + (item.message || "")).toLowerCase();
    
    let target = "";
    if (typeStr.includes("approval") || textStr.includes("approval") || textStr.includes("purchase order")) target = "approvals";
    else if (typeStr.includes("stock") || typeStr.includes("inventory") || typeStr.includes("reorder") || textStr.includes("low stock") || textStr.includes("expir")) target = "reorder";
    else if (typeStr.includes("indent") || textStr.includes("indent")) target = "indent";
    else if (typeStr.includes("po") || typeStr.includes("purchase") || textStr.includes("po ")) target = "pos";
    else if (typeStr.includes("audit") || textStr.includes("audit") || textStr.includes("reconcil")) target = "audit";
    else if (typeStr.includes("issuance") || textStr.includes("issue") || textStr.includes("shortfall")) target = "issuance";
    else if (typeStr.includes("production") || textStr.includes("waste")) target = "production";

    // Store manager overrides
    const isStoreManager = user?.roles?.some(r => r.key === "store_manager");
    if (isStoreManager && target) {
      if (target === "indent") target = "store_manager_indent";
      else if (target === "issuance") target = "store_manager_store_issuance";
      else if (target === "stock" || target === "reorder") target = "store_manager_available_stock";
      else if (target === "pos") target = "store_manager_stock_purchase";
    }

    if (target) setCurrentScreen(target);
    else console.warn("Could not determine notification target for:", item);
    
    if (!item.is_read) handleMarkRead(item.id);
    setIsOpen(false);
  };

  const getIcon = (type, severity) => {
    if (severity === "critical") return <AlertCircle size={16} color={COLORS.danger} />;
    if (severity === "warning") return <AlertTriangle size={16} color={COLORS.warning} />;
    if (type.startsWith("approval")) return <ShieldAlert size={16} color={COLORS.accent} />;
    return <Info size={16} color={COLORS.brand} />;
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open notifications"
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative"
        }}
      >
        <Bell size={15} color={COLORS.muted} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              backgroundColor: COLORS.danger,
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              minWidth: 14,
              height: 14,
              borderRadius: 7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 2px"
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 0,
            width: 320,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            maxHeight: 400
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => handleMarkRead("all")}
                style={{
                  background: "none",
                  border: "none",
                  color: COLORS.accent,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1, maxHeight: 300 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: COLORS.muted, fontSize: 12 }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  style={{
                    padding: "10px 16px",
                    borderBottom: `1px solid ${COLORS.bg}`,
                    background: item.is_read ? "transparent" : `${COLORS.brand}08`,
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                    transition: "background 0.2s",
                    cursor: "pointer"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${COLORS.border}50`}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = item.is_read ? "transparent" : `${COLORS.brand}08`}
                >
                  <div style={{ marginTop: 2 }}>{getIcon(item.type, item.severity)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: item.is_read ? 500 : 600, color: COLORS.text }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{item.message}</div>
                    <div style={{ fontSize: 9, color: COLORS.muted, marginTop: 4 }}>
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!item.is_read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(item.id);
                      }}
                      title="Mark as read"
                      style={{
                        background: "none",
                        border: "none",
                        color: COLORS.muted,
                        cursor: "pointer",
                        padding: 2,
                        display: "flex"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = COLORS.accent}
                      onMouseLeave={(e) => e.currentTarget.style.color = COLORS.muted}
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
