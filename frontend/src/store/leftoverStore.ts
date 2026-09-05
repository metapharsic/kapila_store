import { create } from "zustand";
import { leftovers } from "../api";
import {
  toFrontendLeftover,
  toAPILeftover,
  FrontendLeftover,
  APILeftover
} from "../utils/leftoverAdapter";

interface LeftoverState {
  items: FrontendLeftover[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  fetchLeftovers: (params?: any) => Promise<void>;
  createLeftover: (data: Partial<FrontendLeftover>) => Promise<void>;
}

export const useLeftoverStore = create<LeftoverState>((set) => ({
  items: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,

  fetchLeftovers: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await leftovers.list(params);
      const apiList: APILeftover[] = response.data || [];
      const mapped = apiList.map(toFrontendLeftover);
      set({
        items: mapped,
        total: response.total || 0,
        page: response.page || 1,
        loading: false
      });
    } catch (err: any) {
      set({ error: err.message || "Failed to load leftovers", loading: false });
    }
  },

  createLeftover: async (data) => {
    set({ loading: true, error: null });
    try {
      const payload = toAPILeftover(data);
      const response = await leftovers.create(payload);
      const created: APILeftover = response.data;
      const mapped = toFrontendLeftover(created);

      set((state) => ({
        items: [mapped, ...state.items],
        total: state.total + 1,
        loading: false
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to create leftover", loading: false });
      throw err;
    }
  }
}));
