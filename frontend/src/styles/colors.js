export const COLORS = {
  // Gold Brand / Accent
  brand:      "var(--color-gold, #f4c84b)",
  brandDark:  "var(--color-gold-hover, #f0bb2a)",
  brandLight: "var(--color-gold-dim, rgba(244, 200, 75, 0.15))",
  gold:       "var(--color-gold, #f4c84b)",
  goldHover:  "var(--color-gold-hover, #f0bb2a)",

  // Semantic states
  success:    "var(--color-success, #10b981)",
  warning:    "var(--color-warning, #f59e0b)",
  danger:     "var(--color-danger, #ef4444)",
  info:       "var(--color-info, #3b82f6)",

  // Text / Ink
  text:       "var(--text-main, #18181b)",
  muted:      "var(--text-muted, #52525b)",

  // Surfaces
  bg:         "var(--bg-page, #f5f0e6)",
  surface:    "var(--bg-card, #ffffff)",
  border:     "var(--border-color, rgba(0, 0, 0, 0.08))",
  card:       "var(--bg-card, #ffffff)",

  // Sidebar tokens
  sidebar:           "var(--bg-sidebar, #111113)",
  sidebarText:       "var(--sidebar-text, #a1a1aa)",
  sidebarTextHover:  "var(--sidebar-text-hover, #ffffff)",
  sidebarActiveBg:   "var(--sidebar-active-bg, rgba(244, 200, 75, 0.12))",
  sidebarActiveText: "var(--sidebar-active-text, #f4c84b)",
  sidebarBorder:     "var(--sidebar-border, rgba(255, 255, 255, 0.08))",
  sidebarCategory:   "var(--sidebar-category, #71717a)",

  // Chart palette
  chart1:     "#f4c84b",
  chart2:     "#18181b",
  chart3:     "#71717a",
  chart4:     "#cbd5e1",
  chart5:     "#e2e8f0",

  // Legacy aliases
  accent:     "var(--color-gold, #f4c84b)",
  accentDim:  "var(--color-gold-dark, #c2841f)",
  coral:      "#ef4444",
  teal:       "#10b981",
  purple:     "#8b5cf6",
  primary:    "var(--color-gold, #f4c84b)",
  neutral:    "var(--text-muted, #52525b)",
};

// --- Design tokens: radius / shadow / spacing scales ---
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const SHADOW = {
  sm: "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)",
  md: "0 4px 12px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)",
  lg: "0 10px 28px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.05)",
};

// Single spacing scale (px)
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

// Status pill styling
export const PILL_VARIANTS = {
  success: { bg: "#ECFDF5", fg: "#047857" },
  warning: { bg: "#FEF3C7", fg: "#B45309" },
  danger:  { bg: "#FEF2F2", fg: "#B91C1C" },
  info:    { bg: "#EFF6FF", fg: "#1D4ED8" },
  neutral: { bg: "#F1F5F9", fg: "#475569" },
};

export const DEPARTMENTS = [
  "TIFFINS", "STAFF", "SI-MEALS", "NORTH INDIAN", "CHAT & SOFTY", 
  "CHINESE & DOSA", "MOCKTAILS & CONTINENTAL", "RESTAURANT", "ROOM SERVICE"
];

export const UNITS = ["kg", "g", "L", "ml", "pcs", "dozen", "box", "pkt", "bottle", "tin", "jar", "bulk", "plates", "portions"];

export const STOCK_CATEGORIES = [
  "General", "Spices", "Dairy", "Cereals", "Flour", "Rice", "Oils", "Vegetables",
  "Fruits", "Dry Friuts", "Meat", "Sauces", "Beverages", "Syrup", "Crush",
  "Frozen", "Staples", "Disposal", "House Keeping",
  "Bakery", "Chemicals", "Dals", "Fuel", "Ice Cream", "Linen",
];

export const globalCss = "";
