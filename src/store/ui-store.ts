import { create } from 'zustand';

// UI / client state only. Durable business data lives in SQLite, not here.
type UiState = {
  ready: boolean;
  setReady: (v: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  ready: false,
  setReady: (ready) => set({ ready }),
}));
