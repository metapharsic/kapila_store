import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { COLORS } from "../../styles/colors";
import * as api from "../../api";
import { today } from "../../utils/dates";

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
};

const formatTime = (dateTimeStr) => {
  if (!dateTimeStr) return "";
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
};

const getStatusStyleAndText = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "issued") {
    return { bg: "#D1FAE5", color: "#065F46", text: "Issued" };
  }
  if (s === "pending") {
    return { bg: "#FEF3C7", color: "#92400E", text: "Pending" };
  }
  return { bg: "#F3F4F6", color: "#6B7280", text: status.charAt(0).toUpperCase() + status.slice(1) };
};

export default function IndentHistoryModal({ isOpen, onClose }) {
  const [allIndents, setAllIndents] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [expandedIndentId, setExpandedIndentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const dateFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dateTo = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    setLoading(true);
    setError("");

    api.indents.list({ date_from: dateFrom, date_to: dateTo, limit: 1000 })
      .then((r) => {
        if (r.success) {
          setAllIndents(r.data || []);
        } else {
          setError(r.error || "Failed to load indents");
        }
      })
      .catch((err) => {
        setError(err.message || "An error occurred");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentMonth, isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const todayStr = today();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Group indents by date string YYYY-MM-DD
  const indentsByDate = allIndents.reduce((acc, ind) => {
    if (!ind.date) return acc;
    const d = new Date(ind.date);
    if (isNaN(d.getTime())) return acc;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${dd}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ind);
    return acc;
  }, {});

  const now = new Date();
  const isMaxMonth = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
    setSelectedDate(null);
    setExpandedIndentId(null);
  };

  const handleNextMonth = () => {
    if (!isMaxMonth) {
      setCurrentMonth(new Date(year, month + 1, 1));
      setSelectedDate(null);
      setExpandedIndentId(null);
    }
  };

  // Generate calendar grid cells
  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ type: "empty", key: `empty-${i}` });
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayStr = String(day).padStart(2, "0");
    const monthStr = String(month + 1).padStart(2, "0");
    const dateKey = `${year}-${monthStr}-${dayStr}`;
    const isFuture = dateKey > todayStr;
    const indentsForDay = indentsByDate[dateKey] || [];
    const hasIndents = indentsForDay.length > 0;
    const isSelected = selectedDate === dateKey;

    cells.push({
      type: "day",
      day,
      dateKey,
      isFuture,
      hasIndents,
      indentsCount: indentsForDay.length,
      isSelected,
      key: `day-${day}`
    });
  }

  const selectedIndents = selectedDate ? indentsByDate[selectedDate] || [] : [];

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: COLORS.surface || "#ffffff",
          border: `1px solid ${COLORS.border || "#e2e8f0"}`,
          borderRadius: 12,
          padding: 24,
          width: 580,
          maxWidth: "95%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          position: "relative",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            right: 18,
            top: 18,
            background: "none",
            border: "none",
            color: COLORS.muted || "#64748b",
            cursor: "pointer",
            padding: 4,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: COLORS.text || "#1e293b",
            marginBottom: 4,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Calendar size={18} style={{ color: "#e8a838" }} />
          Indent History
        </h3>
        <p style={{ fontSize: 12.5, color: COLORS.muted || "#64748b", marginBottom: 20 }}>
          Select a date on the calendar to view submitted indents.
        </p>

        {/* Month Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <button
            onClick={handlePrevMonth}
            style={{
              padding: "6px 10px",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
          >
            <ChevronLeft size={16} color="#64748b" />
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text || "#1e293b" }}>
            {monthNames[month]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            disabled={isMaxMonth}
            style={{
              padding: "6px 10px",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              background: isMaxMonth ? "#f8fafc" : "#ffffff",
              display: "flex",
              alignItems: "center",
              cursor: isMaxMonth ? "not-allowed" : "pointer",
              opacity: isMaxMonth ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isMaxMonth) e.currentTarget.style.backgroundColor = "#f8fafc";
            }}
            onMouseLeave={(e) => {
              if (!isMaxMonth) e.currentTarget.style.backgroundColor = "#ffffff";
            }}
          >
            <ChevronRight size={16} color="#64748b" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div style={{ marginBottom: 20 }}>
          {/* Weekday labels */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
              textAlign: "center",
              marginBottom: 6,
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName) => (
              <span
                key={dayName}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: COLORS.muted || "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* Days */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
            }}
          >
            {cells.map((cell, idx) => {
              if (cell.type === "empty") {
                return <div key={cell.key} style={{ aspectRatio: "1" }} />;
              }

              const { day, dateKey, isFuture, hasIndents, indentsCount, isSelected } = cell;

              let cellStyle = {
                aspectRatio: "1",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.15s ease",
                backgroundColor: "#ffffff",
                color: "#1e293b",
              };

              if (isFuture) {
                cellStyle.backgroundColor = "#f8fafc";
                cellStyle.color = "#cbd5e1";
                cellStyle.border = "1px solid #f1f5f9";
                cellStyle.cursor = "not-allowed";
                cellStyle.pointerEvents = "none";
              } else if (isSelected) {
                cellStyle.border = "2px solid #1e293b";
                cellStyle.backgroundColor = "#e2e8f0";
              } else if (hasIndents) {
                cellStyle.border = "1px solid #3b82f6";
                cellStyle.backgroundColor = "#eff6ff";
              }

              return (
                <div
                  key={cell.key}
                  onClick={() => !isFuture && setSelectedDate(dateKey)}
                  style={cellStyle}
                  onMouseEnter={(e) => {
                    if (!isFuture && !isSelected) {
                      e.currentTarget.style.backgroundColor = hasIndents ? "#dbeafe" : "#f1f5f9";
                      e.currentTarget.style.borderColor = hasIndents ? "#3b82f6" : "#cbd5e1";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isFuture && !isSelected) {
                      e.currentTarget.style.backgroundColor = hasIndents ? "#eff6ff" : "#ffffff";
                      e.currentTarget.style.borderColor = hasIndents ? "#3b82f6" : "#e2e8f0";
                    }
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: hasIndents || isSelected ? "700" : "500" }}>
                    {day}
                  </span>
                  {hasIndents && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        right: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        backgroundColor: "#3b82f6",
                        color: "#ffffff",
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {indentsCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Indent List Section */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            borderTop: "1px solid #e2e8f0",
            paddingTop: 16,
            minHeight: 180,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {loading ? (
            <div style={{ margin: "auto", color: COLORS.muted || "#64748b", fontSize: 13, fontWeight: 500 }}>
              ⏳ Loading indents...
            </div>
          ) : error ? (
            <div style={{ margin: "auto", color: "#dc2626", fontSize: 13, fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          ) : !selectedDate ? (
            <div style={{ margin: "auto", color: COLORS.muted || "#64748b", fontSize: 13, fontWeight: 500 }}>
              📅 Select a date on the calendar to view indents.
            </div>
          ) : selectedIndents.length === 0 ? (
            <div style={{ margin: "auto", color: COLORS.muted || "#64748b", fontSize: 13, fontWeight: 500 }}>
              📭 No indents submitted on {formatDate(selectedDate)}.
            </div>
          ) : (
            <div>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: COLORS.muted || "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 12,
                }}
              >
                Indents for {formatDate(selectedDate)} ({selectedIndents.length})
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {selectedIndents.map((indent) => {
                  const isExpanded = expandedIndentId === indent.id;
                  const statusInfo = getStatusStyleAndText(indent.status);

                  return (
                    <div
                      key={indent.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        background: "#f8fafc",
                        padding: 12,
                        transition: "border-color 0.15s",
                      }}
                    >
                      {/* Indent Header */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                        onClick={() => setExpandedIndentId(isExpanded ? null : indent.id)}
                      >
                        <div>
                          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}>
                            {indent.dept}
                          </p>
                          <p style={{ margin: "2px 0 0 0", fontSize: 11, color: COLORS.muted || "#64748b" }}>
                            ID: #{indent.id} {indent.created_at && `· ${formatTime(indent.created_at)}`}
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            className="status-badge"
                            style={{
                              backgroundColor: statusInfo.bg,
                              color: statusInfo.color,
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontWeight: 600,
                            }}
                          >
                            {statusInfo.text}
                          </span>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {/* Expandable Items List */}
                      {isExpanded && (
                        <div style={{ marginTop: 12, borderTop: "1px dashed #e2e8f0", paddingTop: 10 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr>
                                <th style={{ padding: "4px 8px", fontSize: 10, background: "transparent", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>#</th>
                                <th style={{ padding: "4px 8px", fontSize: 10, background: "transparent", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>Item Code</th>
                                <th style={{ padding: "4px 8px", fontSize: 10, background: "transparent", borderBottom: "1px solid #e2e8f0", color: "#64748b" }}>Item Name</th>
                                <th style={{ padding: "4px 8px", fontSize: 10, background: "transparent", borderBottom: "1px solid #e2e8f0", color: "#64748b", textAlign: "right" }}>Qty</th>
                                <th style={{ padding: "4px 8px", fontSize: 10, background: "transparent", borderBottom: "1px solid #e2e8f0", color: "#64748b", textAlign: "left" }}>Unit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(indent.items || []).map((item, index) => (
                                <tr key={item.id || index}>
                                  <td style={{ padding: "6px 8px", fontSize: 12, borderBottom: "1px solid #f1f5f9" }}>{index + 1}</td>
                                  <td style={{ padding: "6px 8px", fontSize: 12, borderBottom: "1px solid #f1f5f9", fontFamily: "monospace", color: "#475569" }}>
                                    {item.item_code || "-"}
                                  </td>
                                  <td style={{ padding: "6px 8px", fontSize: 12, borderBottom: "1px solid #f1f5f9", fontWeight: 500 }}>
                                    {item.name}
                                  </td>
                                  <td style={{ padding: "6px 8px", fontSize: 12, borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: "bold" }}>
                                    {parseFloat(item.qty || 0).toFixed(2)}
                                  </td>
                                  <td style={{ padding: "6px 8px", fontSize: 12, borderBottom: "1px solid #f1f5f9", color: "#64748b" }}>
                                    {item.unit || "kg"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
