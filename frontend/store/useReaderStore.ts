import { create } from "zustand";

export type ReaderMode = "rtl" | "vertical";

type ReaderState = {
  chromeVisible: boolean;
  currentPage: number;
  mode: ReaderMode;
  modeWasChosen: boolean;
  nextPage: (pageCount: number) => void;
  previousPage: () => void;
  setCurrentPage: (page: number) => void;
  setMode: (mode: ReaderMode) => void;
  setModeFromViewport: (mode: ReaderMode) => void;
  toggleChrome: () => void;
};

export const useReaderStore = create<ReaderState>((set) => ({
  chromeVisible: true,
  currentPage: 0,
  mode: "rtl",
  modeWasChosen: false,
  nextPage: (pageCount) =>
    set((state) => ({ currentPage: Math.min(state.currentPage + 1, pageCount - 1) })),
  previousPage: () => set((state) => ({ currentPage: Math.max(state.currentPage - 1, 0) })),
  setCurrentPage: (page) => set({ currentPage: Math.max(0, page) }),
  setMode: (mode) => set({ mode, modeWasChosen: true }),
  setModeFromViewport: (mode) =>
    set((state) => (state.modeWasChosen ? state : { mode })),
  toggleChrome: () => set((state) => ({ chromeVisible: !state.chromeVisible })),
}));
