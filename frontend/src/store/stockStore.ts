import { create } from "zustand";
import { stock } from "../api";
import { 
  toFrontendStock, 
  toAPIStock, 
  FrontendStock, 
  APIStock 
} from "../utils/stockAdapter";

interface StockState {
  items: FrontendStock[];
  loading: boolean;
  error: string | null;
  fetchStock: (params?: any) => Promise<void>;
  createStock: (data: Partial<FrontendStock>) => Promise<void>;
  updateStock: (id: number, data: Partial<FrontendStock>) => Promise<void>;
  deleteStock: (id: number, reason?: string) => Promise<void>;
}

export const useStockStore = create<StockState>((set) => ({
  items: [],
  loading: false,
  error: null,

  fetchStock: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await stock.list(params);
      const apiList: APIStock[] = response.data || [];
      const mapped = apiList.map(toFrontendStock);
      set({ items: mapped, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load stock", loading: false });
    }
  },

  createStock: async (data) => {
    set({ loading: true, error: null });
    try {
      const payload = toAPIStock(data);
      const response = await stock.create(payload);
      const created: APIStock = response.data;
      const mapped = toFrontendStock(created);
      
      set((state) => ({
        items: [mapped, ...state.items],
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to create stock item", loading: false });
      throw err;
    }
  },

  updateStock: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const payload = toAPIStock(data);
      const response = await stock.update(id, payload);
      const updated: APIStock = response.data;
      const mapped = toFrontendStock(updated);

      set((state) => ({
        items: state.items.map((it) => (it.id === id ? mapped : it)),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to update stock item", loading: false });
      throw err;
    }
  },

  deleteStock: async (id, reason) => {
    set({ loading: true, error: null });
    try {
      await stock.remove(id, reason);
      set((state) => ({
        items: state.items.filter((it) => it.id !== id),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to delete stock item", loading: false });
      throw err;
    }
  },
}));
