import { create } from "zustand";

export type ReelGestureAxis = "horizontal" | "vertical" | null;

type ReelFeedState = {
  controlsVisible: boolean;
  gestureAxis: ReelGestureAxis;
  muted: boolean;
  playing: boolean;
  reelIndex: number;
  seriesIndex: number;
  moveHorizontal: (direction: -1 | 1, reelCount: number) => void;
  moveVertical: (direction: -1 | 1, reelCounts: readonly number[]) => void;
  reset: () => void;
  setControlsVisible: (visible: boolean) => void;
  setGestureAxis: (axis: ReelGestureAxis) => void;
  setMuted: (muted: boolean) => void;
  setPlaying: (playing: boolean) => void;
  toggleControls: () => void;
};

const initialState = {
  controlsVisible: true,
  gestureAxis: null as ReelGestureAxis,
  muted: true,
  playing: true,
  reelIndex: 0,
  seriesIndex: 0,
};

export const useReelFeedStore = create<ReelFeedState>((set) => ({
  ...initialState,
  moveHorizontal: (direction, reelCount) =>
    set((state) => ({
      reelIndex: Math.min(Math.max(state.reelIndex + direction, 0), Math.max(reelCount - 1, 0)),
      playing: true,
    })),
  moveVertical: (direction, reelCounts) =>
    set((state) => {
      const seriesIndex = Math.min(
        Math.max(state.seriesIndex + direction, 0),
        Math.max(reelCounts.length - 1, 0),
      );
      return {
        seriesIndex,
        reelIndex: Math.min(state.reelIndex, Math.max((reelCounts[seriesIndex] ?? 1) - 1, 0)),
        playing: true,
      };
    }),
  reset: () => set(initialState),
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),
  setGestureAxis: (gestureAxis) => set({ gestureAxis }),
  setMuted: (muted) => set({ muted }),
  setPlaying: (playing) => set({ playing }),
  toggleControls: () => set((state) => ({ controlsVisible: !state.controlsVisible })),
}));
