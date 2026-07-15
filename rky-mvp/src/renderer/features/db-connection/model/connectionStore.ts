import { create } from 'zustand';
import type { TConnectionStatus } from '@/entities/connection';

interface ConnectionStoreState {
  selectedConnectionId: string | null;
  isFormOpen: boolean;
  editingConnectionId: string | null;
  statusMap: Record<string, TConnectionStatus>;
  selectedSchema: string;
}

interface ConnectionStoreActions {
  setSelectedConnectionId: (id: string | null) => void;
  openForm: (editingId?: string | null) => void;
  closeForm: () => void;
  setStatus: (id: string, status: TConnectionStatus) => void;
  setSelectedSchema: (schema: string) => void;
}

export const useConnectionStore = create<ConnectionStoreState & ConnectionStoreActions>((set) => ({
  selectedConnectionId: null,
  isFormOpen: false,
  editingConnectionId: null,
  statusMap: {},
  selectedSchema: 'public',

  setSelectedConnectionId: (id) => set({ selectedConnectionId: id, selectedSchema: 'public' }),
  openForm: (editingId = null) => set({ isFormOpen: true, editingConnectionId: editingId }),
  closeForm: () => set({ isFormOpen: false, editingConnectionId: null }),
  setStatus: (id, status) => set((s) => ({ statusMap: { ...s.statusMap, [id]: status } })),
  setSelectedSchema: (schema) => set({ selectedSchema: schema }),
}));
