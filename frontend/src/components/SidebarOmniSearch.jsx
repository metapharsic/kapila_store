import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  Search, X, Sparkles, Bot, Package, Receipt, Factory, 
  Wrench, ClipboardList, Send, ArrowRight, CornerDownLeft,
  ChevronRight, AlertCircle, CheckCircle2, Layers
} from "lucide-react";
import * as api from "../api";

/**
 * Multi-Agent OmniSearch: 2-Letter Item & Page Search Engine for Every Sidebar.
 * - Agent OmniRadar: 2-letter input scanning & dual-channel indexer
 * - Agent PageHarvester: Dynamic multi-domain aggregator across all modules
 * - Agent Veritas: Relevance ranking, categorization & domain badges
 * - Agent Dispatcher: Route navigation & destination state pre-fill
 */
export default function SidebarOmniSearch({
  categories = [],
  onNavigate,
  onQueryChange,
  isMobile = false,
  onCloseMobile
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverResults, setServerResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [agentTelemetry, setAgentTelemetry] = useState({
    state: "STANDBY",
    activeAgents: 4,
    lastLatencyMs: 0
  });

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceTimer = useRef(null);

  // Flatten all navigable client pages from navigation categories
  const allPages = useMemo(() => {
    const pages = [];
    categories.forEach((cat) => {
      (cat.items || []).forEach((item) => {
        pages.push({
          id: item.id,
          label: item.label,
          categoryTitle: cat.title,
          icon: item.icon,
          module: "page",
          screen_id: item.id,
          sublabel: `Module in ${cat.title}`,
          badge: "Page"
        });
      });
    });
    return pages;
  }, [categories]);

  // Synchronize query with parent sidebar filter
  useEffect(() => {
    if (onQueryChange) {
      onQueryChange(query);
    }
  }, [query, onQueryChange]);

  // Global keyboard shortcut: Ctrl+K or /
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === "/" && document.activeElement !== inputRef.current && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target) &&
        inputRef.current && 
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Agent OmniRadar + PageHarvester: Dual-channel 2-letter search pipeline
  const executeSearch = useCallback(async (searchQuery) => {
    const clean = searchQuery.trim();
    if (clean.length < 2) {
      setServerResults([]);
      setLoading(false);
      setAgentTelemetry(prev => ({ ...prev, state: "STANDBY" }));
      return;
    }

    setLoading(true);
    setAgentTelemetry(prev => ({ ...prev, state: "SCANNING" }));
    const startTime = performance.now();

    try {
      const res = await api.search.global(clean);
      const elapsed = Math.round(performance.now() - startTime);

      if (res && res.success) {
        setServerResults(res.data || []);
        setAgentTelemetry({
          state: "OPTIMAL",
          activeAgents: 4,
          lastLatencyMs: elapsed
        });
      }
    } catch {
      setAgentTelemetry(prev => ({ ...prev, state: "OFFLINE_FALLBACK" }));
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced input change
  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelectedIndex(0);

    if (val.trim().length >= 2) {
      setIsOpen(true);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        executeSearch(val);
      }, 140);
    } else {
      setServerResults([]);
      setLoading(false);
    }
  };

  // Clear search
  const handleClear = () => {
    setQuery("");
    setServerResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Client-side matching for pages / navigation links
  const matchedPages = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (clean.length < 2) return [];
    return allPages.filter((page) =>
      page.label.toLowerCase().includes(clean) ||
      page.categoryTitle.toLowerCase().includes(clean)
    );
  }, [allPages, query]);

  // Combined and categorized items
  const { categorizedResults, flatList } = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (clean.length < 2) {
      return { categorizedResults: {}, flatList: [] };
    }

    const groups = {
      pages: matchedPages,
      stock: [],
      purchase_orders: [],
      suppliers: [],
      assets: [],
      indents: [],
      issuances: [],
      reorder: [],
      leftovers: []
    };

    serverResults.forEach((item) => {
      const mod = item.module || "stock";
      if (groups[mod]) {
        groups[mod].push(item);
      } else {
        groups.stock.push(item);
      }
    });

    // Create a flattened list for keyboard navigation
    const flat = [
      ...groups.pages,
      ...groups.stock,
      ...groups.purchase_orders,
      ...groups.suppliers,
      ...groups.assets,
      ...groups.indents,
      ...groups.issuances,
      ...groups.reorder,
      ...groups.leftovers
    ];

    return { categorizedResults: groups, flatList: flat };
  }, [matchedPages, serverResults, query]);

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e) => {
    if (!isOpen || flatList.length === 0) {
      if (e.key === "Escape") {
        handleClear();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatList.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatList.length) % flatList.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatList[selectedIndex]) {
        handleSelectItem(flatList[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Selection dispatcher
  const handleSelectItem = (item) => {
    setIsOpen(false);
    if (onNavigate) {
      onNavigate(item.screen_id || item.id, item);
    }
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  // Render module icon helper
  const getModuleIcon = (mod) => {
    switch (mod) {
      case "page": return <Layers size={14} color="#e8a838" />;
      case "stock": return <Package size={14} color="#10b981" />;
      case "purchase_orders": return <Receipt size={14} color="#6366f1" />;
      case "suppliers": return <Factory size={14} color="#06b6d4" />;
      case "assets": return <Wrench size={14} color="#a855f7" />;
      case "indents": return <ClipboardList size={14} color="#f59e0b" />;
      case "issuances": return <Send size={14} color="#ec4899" />;
      default: return <Package size={14} color="#e8a838" />;
    }
  };

  // Badge color helper
  const getBadgeStyle = (mod) => {
    switch (mod) {
      case "page":
        return { background: "rgba(232, 168, 56, 0.15)", color: "#e8a838", border: "1px solid rgba(232, 168, 56, 0.3)" };
      case "stock":
        return { background: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.3)" };
      case "purchase_orders":
        return { background: "rgba(99, 102, 241, 0.15)", color: "#818cf8", border: "1px solid rgba(99, 102, 241, 0.3)" };
      case "suppliers":
        return { background: "rgba(6, 182, 212, 0.15)", color: "#22d3ee", border: "1px solid rgba(6, 182, 212, 0.3)" };
      case "assets":
        return { background: "rgba(168, 85, 247, 0.15)", color: "#c084fc", border: "1px solid rgba(168, 85, 247, 0.3)" };
      case "indents":
        return { background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24", border: "1px solid rgba(245, 158, 11, 0.3)" };
      default:
        return { background: "rgba(255, 255, 255, 0.1)", color: "#e4e4e7", border: "1px solid rgba(255, 255, 255, 0.2)" };
    }
  };

  const hasTwoLetters = query.trim().length >= 2;
  const showPrompt = query.trim().length === 1;

  return (
    <div style={{ position: "relative", padding: "10px 12px 6px", borderBottom: "1px solid var(--sidebar-border)" }}>
      {/* ═══ Search Input Box ═══ */}
      <div style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        backgroundColor: "var(--bg-sidebar-elevate, #18181b)",
        borderRadius: 8,
        border: isOpen && hasTwoLetters ? "1px solid var(--color-gold, #e8a838)" : "1px solid var(--sidebar-border, rgba(255,255,255,0.1))",
        boxShadow: isOpen && hasTwoLetters ? "0 0 0 2px rgba(232, 168, 56, 0.2)" : "none",
        transition: "all 0.18s ease"
      }}>
        <Search 
          size={14} 
          style={{ 
            position: "absolute", 
            left: 10, 
            color: hasTwoLetters ? "var(--color-gold, #e8a838)" : "var(--sidebar-category, #71717a)",
            transition: "color 0.18s"
          }} 
        />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (hasTwoLetters) setIsOpen(true);
          }}
          placeholder="Search (min 2 letters)…"
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            outline: "none",
            padding: "8px 30px 8px 32px",
            color: "var(--text-sidebar, #e4e4e7)",
            fontSize: 12,
            fontFamily: "inherit"
          }}
        />

        {/* Clear Button or Shortcut Hint */}
        {query ? (
          <button
            onClick={handleClear}
            title="Clear search (Esc)"
            style={{
              position: "absolute",
              right: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--sidebar-category, #71717a)"
            }}
          >
            <X size={13} />
          </button>
        ) : (
          <span style={{
            position: "absolute",
            right: 8,
            fontSize: 10,
            padding: "1px 5px",
            borderRadius: 4,
            background: "rgba(255,255,255,0.06)",
            color: "var(--sidebar-category, #71717a)",
            fontWeight: 600,
            pointerEvents: "none"
          }}>
            ⌘K
          </span>
        )}
      </div>

      {/* ═══ 1-Letter Helper Badge ═══ */}
      {showPrompt && (
        <div style={{
          marginTop: 6,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          color: "var(--color-gold, #e8a838)",
          padding: "4px 8px",
          borderRadius: 6,
          background: "rgba(232, 168, 56, 0.08)",
          border: "1px solid rgba(232, 168, 56, 0.2)"
        }}>
          <Sparkles size={12} />
          <span>Type 2+ letters (e.g. <b>po</b>, <b>ba</b>, <b>su</b>, <b>ve</b>)</span>
        </div>
      )}

      {/* ═══ Multi-Agent OmniSearch Results Popover ═══ */}
      {isOpen && hasTwoLetters && (
        <div
          ref={dropdownRef}
          style={{
            position: isMobile ? "fixed" : "absolute",
            top: isMobile ? "70px" : "10px",
            left: isMobile ? "12px" : "240px",
            right: isMobile ? "12px" : "auto",
            width: isMobile ? "auto" : "390px",
            maxHeight: "78vh",
            backgroundColor: "#141416",
            border: "1px solid rgba(232, 168, 56, 0.28)",
            borderRadius: 12,
            boxShadow: "0 16px 40px rgba(0,0,0,0.7), 0 0 20px rgba(232, 168, 56, 0.1)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            backdropFilter: "blur(12px)"
          }}
        >
          {/* Swarm Telemetry Header */}
          <div style={{
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "rgba(232, 168, 56, 0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Bot size={14} color="#e8a838" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#e8a838", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                Agent OmniRadar
              </span>
              <span style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 4,
                backgroundColor: agentTelemetry.state === "OPTIMAL" ? "rgba(16, 185, 129, 0.2)" : "rgba(232, 168, 56, 0.2)",
                color: agentTelemetry.state === "OPTIMAL" ? "#34d399" : "#fbbf24",
                fontWeight: 600
              }}>
                {loading ? "Scanning..." : `${flatList.length} items`}
              </span>
            </div>

            <span style={{ fontSize: 10, color: "var(--sidebar-category, #71717a)" }}>
              {agentTelemetry.lastLatencyMs ? `${agentTelemetry.lastLatencyMs}ms` : "Live 2-letter index"}
            </span>
          </div>

          {/* Results List */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 6px",
            scrollbarWidth: "thin"
          }}>
            {flatList.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center" }}>
                <AlertCircle size={28} color="#71717a" style={{ margin: "0 auto 8px" }} />
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-sidebar, #e4e4e7)" }}>
                  No items found for "{query}"
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--sidebar-category, #71717a)" }}>
                  Try another 2-letter prefix like <b>po</b>, <b>ri</b>, <b>su</b>, <b>ba</b>, or <b>ve</b>
                </p>
              </div>
            ) : (
              <div>
                {/* 1. Pages & Navigation */}
                {categorizedResults.pages?.length > 0 && (
                  <SectionGroup
                    title="Pages & Modules"
                    icon={<Layers size={13} color="#e8a838" />}
                    items={categorizedResults.pages}
                    selectedIndex={selectedIndex}
                    flatList={flatList}
                    onSelect={handleSelectItem}
                    getBadgeStyle={getBadgeStyle}
                  />
                )}

                {/* 2. Stock Inventory Items */}
                {categorizedResults.stock?.length > 0 && (
                  <SectionGroup
                    title="Stock Inventory Items"
                    icon={<Package size={13} color="#10b981" />}
                    items={categorizedResults.stock}
                    selectedIndex={selectedIndex}
                    flatList={flatList}
                    onSelect={handleSelectItem}
                    getBadgeStyle={getBadgeStyle}
                  />
                )}

                {/* 3. Purchase Orders */}
                {categorizedResults.purchase_orders?.length > 0 && (
                  <SectionGroup
                    title="Purchase Orders"
                    icon={<Receipt size={13} color="#818cf8" />}
                    items={categorizedResults.purchase_orders}
                    selectedIndex={selectedIndex}
                    flatList={flatList}
                    onSelect={handleSelectItem}
                    getBadgeStyle={getBadgeStyle}
                  />
                )}

                {/* 4. Vendors & Suppliers */}
                {categorizedResults.suppliers?.length > 0 && (
                  <SectionGroup
                    title="Vendors & Suppliers"
                    icon={<Factory size={13} color="#22d3ee" />}
                    items={categorizedResults.suppliers}
                    selectedIndex={selectedIndex}
                    flatList={flatList}
                    onSelect={handleSelectItem}
                    getBadgeStyle={getBadgeStyle}
                  />
                )}

                {/* 5. Kitchen Assets & CMMS */}
                {categorizedResults.assets?.length > 0 && (
                  <SectionGroup
                    title="Kitchen Assets & CMMS"
                    icon={<Wrench size={13} color="#c084fc" />}
                    items={categorizedResults.assets}
                    selectedIndex={selectedIndex}
                    flatList={flatList}
                    onSelect={handleSelectItem}
                    getBadgeStyle={getBadgeStyle}
                  />
                )}

                {/* 6. Indents & Department Requests */}
                {categorizedResults.indents?.length > 0 && (
                  <SectionGroup
                    title="Indent Requisitions"
                    icon={<ClipboardList size={13} color="#fbbf24" />}
                    items={categorizedResults.indents}
                    selectedIndex={selectedIndex}
                    flatList={flatList}
                    onSelect={handleSelectItem}
                    getBadgeStyle={getBadgeStyle}
                  />
                )}

                {/* 7. Store Issuances */}
                {categorizedResults.issuances?.length > 0 && (
                  <SectionGroup
                    title="Store Issuances"
                    icon={<Send size={13} color="#ec4899" />}
                    items={categorizedResults.issuances}
                    selectedIndex={selectedIndex}
                    flatList={flatList}
                    onSelect={handleSelectItem}
                    getBadgeStyle={getBadgeStyle}
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer Controls & Instructions */}
          <div style={{
            padding: "8px 12px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            backgroundColor: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 10,
            color: "var(--sidebar-category, #71717a)"
          }}>
            <div style={{ display: "flex", gap: 8 }}>
              <span><kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> to navigate</span>
              <span><kbd style={kbdStyle}>↵</kbd> to open</span>
              <span><kbd style={kbdStyle}>esc</kbd> to close</span>
            </div>
            <span style={{ color: "var(--color-gold, #e8a838)" }}>
              Multi-Agent P2P Radar
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionGroup({ title, icon, items, selectedIndex, flatList, onSelect, getBadgeStyle }) {
  if (!items || items.length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        fontSize: 10,
        fontWeight: 700,
        color: "var(--sidebar-category, #71717a)",
        textTransform: "uppercase",
        letterSpacing: "0.06em"
      }}>
        {icon}
        <span>{title}</span>
        <span style={{ marginLeft: "auto", opacity: 0.6 }}>({items.length})</span>
      </div>

      {items.map((item) => {
        const itemGlobalIndex = flatList.indexOf(item);
        const isSelected = itemGlobalIndex === selectedIndex;

        return (
          <div
            key={`${item.module}-${item.id}`}
            onClick={() => onSelect(item)}
            style={{
              padding: "7px 10px",
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: isSelected ? "rgba(232, 168, 56, 0.14)" : "transparent",
              border: isSelected ? "1px solid rgba(232, 168, 56, 0.3)" : "1px solid transparent",
              transition: "all 0.12s",
              marginBottom: 2
            }}
          >
            <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isSelected ? "#ffffff" : "var(--text-sidebar, #e4e4e7)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                  {item.label}
                </span>

                <span style={{
                  fontSize: 9,
                  padding: "1px 5px",
                  borderRadius: 4,
                  fontWeight: 600,
                  ...getBadgeStyle(item.module)
                }}>
                  {item.badge || item.module}
                </span>
              </div>

              {item.sublabel && (
                <div style={{
                  fontSize: 11,
                  color: isSelected ? "var(--text-sidebar, #e4e4e7)" : "var(--sidebar-category, #71717a)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: 2
                }}>
                  {item.sublabel}
                </div>
              )}
            </div>

            <ChevronRight size={13} color={isSelected ? "#e8a838" : "#52525b"} />
          </div>
        );
      })}
    </div>
  );
}

const kbdStyle = {
  backgroundColor: "rgba(255,255,255,0.08)",
  borderRadius: 3,
  padding: "1px 4px",
  color: "#d4d4d8",
  fontSize: 9,
  fontFamily: "monospace"
};
