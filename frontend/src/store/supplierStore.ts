import { create } from "zustand";
import { suppliers } from "../api";
import { 
  toFrontendSupplier, 
  toAPISupplier, 
  FrontendSupplier, 
  APISupplier 
} from "../utils/supplierAdapter";

interface SupplierState {
  suppliers: FrontendSupplier[];
  loading: boolean;
  error: string | null;
  fetchSuppliers: (params?: any) => Promise<void>;
  updateSupplier: (id: number, data: Partial<FrontendSupplier>) => Promise<void>;
}

export const useSupplierStore = create<SupplierState>((set) => ({
  suppliers: [],
  loading: false,
  error: null,

  fetchSuppliers: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await suppliers.list(params);
      const apiList: APISupplier[] = response.data || [];
      const mapped = apiList.map(toFrontendSupplier);
      set({ suppliers: mapped, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load suppliers", loading: false });
    }
  },

  updateSupplier: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const payload = toAPISupplier(data);
      const response = await suppliers.update(id, payload);
      const updatedApiSupplier: APISupplier = response.data;
      const updated = toFrontendSupplier(updatedApiSupplier);
      
      set((state) => ({
        suppliers: state.suppliers.map((s) => (s.id === id ? updated : s)),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to update supplier", loading: false });
      throw err;
    }
  },
}));
