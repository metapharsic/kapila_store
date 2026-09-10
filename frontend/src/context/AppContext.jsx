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
      setNavBlocker
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
