import { create } from "zustand";

type AppState = {
  swipeCount: number;
  mbti: string | null;
  setBootstrap: (swipeCount: number, mbti: string | null) => void;
  incrementSwipe: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  swipeCount: 0,
  mbti: null,
  setBootstrap: (swipeCount, mbti) => set({ swipeCount, mbti }),
  incrementSwipe: () => set((state) => ({ swipeCount: state.swipeCount + 1 })),
}));
