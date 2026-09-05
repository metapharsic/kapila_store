import { create } from "zustand";
import { indents } from "../api";
import { 
  toFrontendIndent, 
  toAPIIndent, 
  FrontendIndent, 
  APIIndent 
} from "../utils/indentAdapter";

interface IndentState {
  indentsList: FrontendIndent[];
  loading: boolean;
  error: string | null;
  fetchIndents: (params?: any) => Promise<void>;
  createIndent: (data: Partial<FrontendIndent>) => Promise<void>;
  updateIndentStatus: (id: number, status: string) => Promise<void>;
  updateIndentItems: (id: number, items: any[]) => Promise<void>;
  deleteIndent: (id: number) => Promise<void>;
}

export const useIndentStore = create<IndentState>((set) => ({
  indentsList: [],
  loading: false,
  error: null,

  fetchIndents: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await indents.list(params);
      const apiList: APIIndent[] = response.data || [];
      const mapped = apiList.map(toFrontendIndent);
      set({ indentsList: mapped, loading: false });
    } catch (err: any) {
      set({ error: err.message || "Failed to load indents", loading: false });
    }
  },

  createIndent: async (data) => {
    set({ loading: true, error: null });
    try {
      const payload = toAPIIndent(data);
      const response = await indents.create(payload);
      const created: APIIndent = response.data;
      const mapped = toFrontendIndent(created);
      
      set((state) => ({
        indentsList: [mapped, ...state.indentsList],
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to create indent", loading: false });
      throw err;
    }
  },

  updateIndentStatus: async (id, status) => {
    set({ loading: true, error: null });
    try {
      const response = await indents.updateStatus(id, status);
      const updated: APIIndent = response.data;
      const mapped = toFrontendIndent(updated);

      set((state) => ({
        indentsList: state.indentsList.map((ind) => (ind.id === id ? mapped : ind)),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to update indent status", loading: false });
      throw err;
    }
  },

  updateIndentItems: async (id, items) => {
    set({ loading: true, error: null });
    try {
      const response = await indents.updateItems(id, items);
      const updated: APIIndent = response.data;
      const mapped = toFrontendIndent(updated);

      set((state) => ({
        indentsList: state.indentsList.map((ind) => (ind.id === id ? mapped : ind)),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to update indent items", loading: false });
      throw err;
    }
  },

  deleteIndent: async (id) => {
    set({ loading: true, error: null });
    try {
      await indents.remove(id);
      set((state) => ({
        indentsList: state.indentsList.filter((ind) => ind.id !== id),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || "Failed to delete indent", loading: false });
      throw err;
    }
  },
}));
