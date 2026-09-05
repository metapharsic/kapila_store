export const COLORS = {
  // Primary — Slate/Grey (replaces bright indigo)
  brand:      "#475569",   // Slate-600 — primary actions, active nav
  brandDark:  "#334155",   // Slate-700 — hover states
  brandLight: "#F1F5F9",   // Slate-100 — hover backgrounds, focus rings
  
  // Semantic states
  success:    "#10b981",   // Emerald — positive states (keep)
  warning:    "#f59e0b",   // Amber — caution states (keep)
  danger:     "#ef4444",   // Red — errors, critical
  info:       "#3b82f6",   // Blue — informational states
  
  // Text
  text:       "#1e293b",   // Slate-800
  muted:      "#64748b",   // Slate-500
  
  // Surfaces
  bg:         "var(--color-bg-page)",
  surface:    "var(--color-bg-card)",
  border:     "var(--color-border)",
  
  // Chart palette
  chart1:     "#475569",   // Slate-600
  chart2:     "#64748b",   // Slate-500
  chart3:     "#94a3b8",   // Slate-400
  chart4:     "#cbd5e1",   // Slate-300
  chart5:     "#e2e8f0",   // Slate-200
  
  // Legacy aliases
  accent:     "#475569",
  accentDim:  "#334155",
  coral:      "#ef4444",
  teal:       "#10b981",
  purple:     "#8b5cf6",
  primary:    "#475569",
  neutral:    "#64748b",
  card:       "var(--color-bg-card)",
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

export const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

  :root {
    /* --- Fonts --- */
    --font-display: 'DM Serif Display', Georgia, serif;
    --font-sans:    'DM Sans', 'Plus Jakarta Sans', system-ui, sans-serif;

    /* --- Kapila Luxury Brand Colors --- */
    --color-gold:       #e8a838;
    --color-gold-hover: #f3b952;
    --color-gold-dark:  #c2841f;
    --color-gold-dim:   rgba(232, 168, 56, 0.15);
    --color-gold-glow:  rgba(232, 168, 56, 0.25);

    /* --- Type Scale --- */
    --text-label:  12px;    /* form labels, small headers */
    --text-data:   13.5px;  /* table data, regular text */
    --text-body:   14px;    /* body text, descriptions */
    --text-kpi:    24px;    /* KPI values */
    --text-title:  15px;    /* Section / panel titles */

    /* --- Spacing --- */
    --gap-xs: 4px;
    --gap-sm: 8px;
    --gap-md: 16px;
    --gap-lg: 24px;
    
    /* --- Sidebar (LIGHT theme) --- */
    --sidebar-bg:         #FFFFFF;
    --sidebar-border:     #E5E7EB;
    --sidebar-text:       #6B7280;
    --sidebar-text-hover: #1F2937;
    --sidebar-active-bg:  #F1F5F9;
    --sidebar-active-text:#1F2937;
    --sidebar-hover-bg:   #F3F4F6;
    --sidebar-category:   #9CA3AF;

    /* --- Kapila IMS Stock Master Redesign Tokens --- */
    --color-bg-page:        #F5F7FA;
    --color-bg-card:        #FFFFFF;
    --color-bg-sidebar:     #FFFFFF;
    --color-accent-primary: #475569;
    --color-accent-primary-light: #F1F5F9;
    --color-accent-green:   #10B981;
    --color-accent-green-light: #ECFDF5;
    --color-accent-amber:   #F59E0B;
    --color-accent-amber-light: #FEF3C7;
    --color-accent-red:     #EF4444;
    --color-accent-red-light: #FEF2F2;
    --color-accent-blue:    #3B82F6;
    --color-accent-blue-light: #EFF6FF;
    --color-text-primary:   #1E293B;
    --color-text-secondary: #475569;
    --color-text-muted:     #64748B;
    --color-border:         #E5E7EB;
    --color-border-strong:  #D1D5DB;
    --radius-sm:            8px;
    --radius-md:            12px;
    --radius-lg:            16px;
    --shadow-card:          0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06);
    --shadow-card-hover:    0 4px 6px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06);
    --shadow-sidebar:       1px 0 3px rgba(0,0,0,0.04);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: var(--color-bg-page);
    color: var(--color-text-primary);
    font-family: 'Inter', system-ui, sans-serif;
    font-size: var(--text-body);
    height: 100%;
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
    -webkit-font-smoothing: antialiased;
  }
  #root { height: 100%; }
  
  /* --- Scrollbar Styling --- */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  
  input, select, textarea {
    background: #ffffff;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    border-radius: 8px;
    padding: 8px 12px;
    font-family: 'Inter', sans-serif;
    font-size: var(--text-data);
    outline: none;
    width: 100%;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 3px var(--color-accent-primary-light);
  }
  select option { background: #ffffff; color: var(--color-text-primary); }
  button { cursor: pointer; font-family: 'Inter', sans-serif; font-size: var(--text-data); font-weight: 500; border: none; border-radius: 8px; transition: all 0.15s; }
  
  /* --- Table Styling --- */
  table { width: 100%; border-collapse: collapse; font-size: var(--text-data); }
  th {
    text-align: left;
    padding: 12px 16px;
    color: var(--color-text-secondary);
    font-weight: 600;
    font-size: var(--text-label);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-bottom: 1px solid var(--color-border);
    background: #f8fafc;
    white-space: nowrap;
  }
  td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
    vertical-align: middle;
    font-size: var(--text-data);
    color: var(--color-text-primary);
    transition: background-color 0.15s ease;
  }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr:hover td { background: var(--color-accent-primary-light); }
  
  /* --- Row Actions --- */
  .row-actions { transition: opacity 0.15s; opacity: 0.7; }
  tr:hover .row-actions { opacity: 1; }
  .row-actions:hover { opacity: 1; }
  .danger-hover:hover { color: var(--color-accent-red) !important; border-color: var(--color-accent-red) !important; }
  
  /* --- Badge & Chip Utilities --- */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    white-space: nowrap;
  }
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 100px;
    font-size: 13px;
    font-weight: 500;
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    transition: all 0.15s ease;
    cursor: pointer;
    user-select: none;
  }
  .chip:hover {
    background: #e2e8f0;
    color: #0f172a;
    border-color: #cbd5e1;
  }
  .chip.active {
    background: var(--color-accent-primary-light);
    color: var(--color-accent-primary);
    border-color: var(--color-accent-primary);
  }

  .stock-table th, .stock-table td { padding: 12px 14px; }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .pulse { animation: pulse 2s infinite; }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-in { animation: fadeIn 0.2s ease-out; }
  
  /* --- Responsive Utilities --- */
  .resp-table-wrap {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    /* Optional shadow indicator for scrolling */
    background: linear-gradient(to right, white 30%, rgba(255,255,255,0)),
      linear-gradient(to right, rgba(255,255,255,0), white 70%) 100% 0,
      radial-gradient(farthest-side at 0 50%, rgba(0,0,0,.15), rgba(0,0,0,0)),
      radial-gradient(farthest-side at 100% 50%, rgba(0,0,0,.15), rgba(0,0,0,0)) 100% 0;
    background-repeat: no-repeat;
    background-size: 40px 100%, 40px 100%, 14px 100%, 14px 100%;
    background-attachment: local, local, scroll, scroll;
  }
  
  .resp-table-wrap table {
    min-width: 600px; /* Force minimum width to trigger scroll on mobile */
  }

  .resp-form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
    width: 100%;
  }

  /* Basic responsive grid columns */
  .resp-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
  .resp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .resp-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }

  @media (max-width: 767px) {
    .resp-grid-2, .resp-grid-3, .resp-grid-4 {
      grid-template-columns: 1fr;
    }
    
    .resp-stack {
      flex-direction: column !important;
      align-items: stretch !important;
    }
    
    .resp-hide-mobile {
      display: none !important;
    }

    .resp-panel-layout {
      flex-direction: column !important;
    }
    .resp-panel-left {
      width: 100% !important;
      min-width: 100% !important;
    }
  }

  /* Responsive panel classes for desktop */
  .resp-panel-layout {
    display: flex;
    gap: 20px;
    align-items: stretch;
  }
  .resp-panel-left {
    width: 30%;
    min-width: 280px;
    flex-shrink: 0;
  }
  .resp-panel-right {
    flex: 1;
    min-height: 360px;
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    .resp-grid-3, .resp-grid-4 {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* =============================================
     MOBILE-FIRST UTILITY CLASSES
     Used by Available Stock, Purchase Order, Issuance
     ============================================= */

  /* Touch targets: all interactive elements ≥44px on mobile */
  @media (max-width: 767px) {
    button, [role="button"], select, input[type="checkbox"] {
      min-height: 44px;
    }
    input[type="checkbox"] {
      min-width: 24px;
      min-height: 24px;
    }
  }

  /* Horizontal scrollable pill/chip filter bar */
  .mob-filter-bar {
    display: flex;
    gap: 8px;
    align-items: center;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: 2px;
    flex-wrap: nowrap;
  }
  .mob-filter-bar::-webkit-scrollbar { display: none; }
  .mob-filter-bar .chip, .mob-filter-bar select {
    flex-shrink: 0;
  }

  /* Mobile item card — used in Stock table, PO form, Issuance grid */
  .mob-item-card {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .mob-item-card:hover {
    box-shadow: var(--shadow-card-hover);
  }
  .mob-item-card.low-stock {
    border-left: 3px solid var(--color-accent-red);
    background: var(--color-accent-red-light);
  }
  .mob-item-card.confirmed {
    border-left: 3px solid var(--color-accent-green);
    background: var(--color-accent-green-light);
  }
  .mob-item-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .mob-item-card-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .mob-item-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .mob-item-field label {
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .mob-item-field input,
  .mob-item-field select {
    padding: 10px 12px;
    font-size: 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    background: var(--color-bg-page);
    color: var(--color-text-primary);
    width: 100%;
    min-height: 44px;
    transition: border-color 0.2s;
  }
  .mob-item-field input:focus,
  .mob-item-field select:focus {
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 0 3px var(--color-accent-primary-light);
    outline: none;
  }

  /* Step indicator for multi-step mobile flows */
  .mob-step-bar {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 12px 16px;
    background: var(--color-bg-card);
    border-bottom: 1px solid var(--color-border);
  }
  .mob-step {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-muted);
  }
  .mob-step.active {
    color: var(--color-accent-primary);
  }
  .mob-step.done {
    color: var(--color-accent-green);
  }
  .mob-step-num {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid currentColor;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
  }
  .mob-step.active .mob-step-num {
    background: var(--color-accent-primary);
    color: white;
    border-color: var(--color-accent-primary);
  }
  .mob-step.done .mob-step-num {
    background: var(--color-accent-green);
    color: white;
    border-color: var(--color-accent-green);
  }
  .mob-step-divider {
    width: 20px;
    height: 1px;
    background: var(--color-border);
    flex-shrink: 0;
  }

  /* Slide transition for mobile step flows */
  @keyframes slideInRight {
    from { transform: translateX(24px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
  @keyframes slideInLeft {
    from { transform: translateX(-24px); opacity: 0; }
    to   { transform: translateX(0);     opacity: 1; }
  }
  .slide-in-right { animation: slideInRight 0.22s cubic-bezier(0.4,0,0.2,1); }
  .slide-in-left  { animation: slideInLeft  0.22s cubic-bezier(0.4,0,0.2,1); }

  /* Sticky bottom action bar on mobile */
  .mob-sticky-action {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--color-bg-card);
    border-top: 1px solid var(--color-border);
    padding: 12px 16px;
    box-shadow: 0 -4px 12px rgba(0,0,0,0.06);
    z-index: 50;
  }

  /* Mobile 2×2 action button grid */
  .mob-action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 16px;
  }
  .mob-action-grid button {
    width: 100%;
    justify-content: center;
  }

  /* Mobile KPI row — 2-col compact */
  @media (max-width: 767px) {
    .resp-grid-3.kpi-row {
      grid-template-columns: 1fr 1fr;
    }
    .resp-grid-3.kpi-row > *:last-child {
      grid-column: 1 / -1;
    }
  }
`;
