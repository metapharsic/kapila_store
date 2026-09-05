import { create } from "zustand";
import { issuances } from "../api";
import { 
  toFrontendIssuance, 
  toAPIIssuance, 
  FrontendIssuance, 
  APIIssuance 
} from "../utils/issuanceAdapter";

interface IssuanceState {
  issuancesList: FrontendIssuance[];
  loading: boolean;
  error: string | null;
  fetchIssuances: (params?: any) => Promise<void>;
  createIssuance: (data: Partial<FrontendIssuance>) => Promise<void>;
  deleteIssuance: (id: number) => Promise<void>;
  bulkIssueIndents: (indentIds: number[]) => Promise<void>;
}

export const useIssuanceStore = create<IssuanceState>((set) => ({
  issuancesList: [],
  loading: false,
  error: null,

  fetchIssuances: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await issuances.list(params);
      const apiList: APIIssuance[] = response.data || [];
      const mapped = apiList.map(toFrontendIssuance);
      set({ issuancesList: mapped, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load issuances", loading: false });
    }
  },

  createIssuance: async (data) => {
    set({ loading: true, error: null });
    try {
      const payload = toAPIIssuance(data);
      const response = await issuances.create(payload);
      const created: APIIssuance = response.data;
      const mapped = toFrontendIssuance(created);
      
      set((state) => ({
        issuancesList: [mapped, ...state.issuancesList],
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to record issuance", loading: false });
      throw err;
    }
  },

  deleteIssuance: async (id) => {
    set({ loading: true, error: null });
    try {
      await issuances.remove(id);
      set((state) => ({
        issuancesList: state.issuancesList.filter((iss) => iss.id !== id),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to delete issuance", loading: false });
      throw err;
    }
  },

  bulkIssueIndents: async (indentIds) => {
    set({ loading: true, error: null });
    try {
      await issuances.bulkIssue(indentIds);
      // Re-fetch list to capture the auto-created issuances
      const response = await issuances.list();
      const apiList: APIIssuance[] = response.data || [];
      const mapped = apiList.map(toFrontendIssuance);
      set({ issuancesList: mapped, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed bulk issuance", loading: false });
      throw err;
    }
  },
}));
