import { createContext, useContext, useState, useCallback } from "react";
import * as api from "../api";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Lightweight global cache — screens can pull fresh data themselves,
  // but stock names and details are shared across Indent autocomplete + Issuance
  const [stockNames, setStockNames] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [reorderAlerts, setReorderAlerts] = useState([]);
  const [currentScreen, setCurrentScreen] = useState("dashboard");
  const [indentPreFill, setIndentPreFill] = useState(null);
  const [indentSmartPreFill, setIndentSmartPreFill] = useState(null);
  const [navBlocker, setNavBlocker] = useState(null);

  const changeScreen = useCallback(async (newScreen) => {
    if (navBlocker) {
      const allowed = await navBlocker(newScreen);
      if (!allowed) return;
    }
    setCurrentScreen(newScreen);
  }, [navBlocker]);

  const refreshStockNames = useCallback(async () => {
    try {
      const res = await api.stock.list({ limit: 5000, sort: "name", order: "asc", all: "true" });
      setStocks(res.data || []);
      setStockNames((res.data || []).map((s) => s.name));
    } catch {}
  }, []);

  const refreshReorderAlerts = useCallback(async () => {
    try {
      const res = await api.reorderPoints.alerts();
      if (res && res.success) setReorderAlerts(res.data || []);
    } catch {}
  }, []);

  const [poPreFill, setPoPreFill] = useState(null);
  const [grnPreFill, setGrnPreFill] = useState(null);

  // Modular Extensions State (Commercial Kitchen CMMS & Staff HRMS / Night Audit)
  // Default: Dormant/Hidden to keep daily store operations streamlined.
  const [modularExtensions, setModularExtensionsState] = useState(() => {
    try {
      const stored = localStorage.getItem("kapila_modular_extensions");
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          maintenance: !!parsed.maintenance,
          staff_audit: !!parsed.staff_audit,
        };
      }
    } catch {}
    return { maintenance: false, staff_audit: false };
  });

  const toggleModularExtension = useCallback((moduleKey, forceVal) => {
    setModularExtensionsState((prev) => {
      const nextVal = typeof forceVal === "boolean" ? forceVal : !prev[moduleKey];
      const updated = { ...prev, [moduleKey]: nextVal };
      try {
        localStorage.setItem("kapila_modular_extensions", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const setModularExtensions = useCallback((updates) => {
    setModularExtensionsState((prev) => {
      const updated = typeof updates === "function" ? updates(prev) : { ...prev, ...updates };
      try {
        localStorage.setItem("kapila_modular_extensions", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const isModuleEnabled = useCallback((moduleKey) => {
    return !!modularExtensions[moduleKey];
  }, [modularExtensions]);

  return (
    <AppContext.Provider value={{
      stockNames,
      stocks,
      reorderAlerts,
      refreshReorderAlerts,
      refreshStockNames,
      currentScreen, 
      setCurrentScreen: changeScreen,
      indentPreFill,
      setIndentPreFill,
      indentSmartPreFill,
      setIndentSmartPreFill,
      poPreFill,
      setPoPreFill,
      grnPreFill,
      setGrnPreFill,
      setNavBlocker,
      modularExtensions,
      toggleModularExtension,
      setModularExtensions,
      isModuleEnabled
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
