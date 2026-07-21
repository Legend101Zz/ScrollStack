"use client";

import { useCallback, useRef, type PointerEventHandler } from "react";

import type { ReelGestureAxis } from "./useReelFeedStore";

const AXIS_LOCK_PX = 12;
const AXIS_DOMINANCE = 1.25;
const NAVIGATION_PX = 72;
const NAVIGATION_VELOCITY_PX_MS = 0.55;
const INTERACTIVE_START =
  "button, a, input, textarea, select, [role='slider'], [data-reel-interactive], [data-reel-caption]";

type GestureState = {
  axis: ReelGestureAxis;
  pointerId: number;
  startTime: number;
  startX: number;
  startY: number;
};

type AxisLockedGestureOptions = {
  onAxisChange: (axis: ReelGestureAxis) => void;
  onNavigateHorizontal: (direction: -1 | 1) => void;
  onNavigateVertical: (direction: -1 | 1) => void;
};

export function useAxisLockedGesture({
  onAxisChange,
  onNavigateHorizontal,
  onNavigateVertical,
}: AxisLockedGestureOptions): {
  onPointerCancel: PointerEventHandler<HTMLElement>;
  onPointerDown: PointerEventHandler<HTMLElement>;
  onPointerMove: PointerEventHandler<HTMLElement>;
  onPointerUp: PointerEventHandler<HTMLElement>;
} {
  const gesture = useRef<GestureState | null>(null);

  const finish = useCallback(
    (event: React.PointerEvent<HTMLElement>, navigate: boolean) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;

      if (navigate && current.axis) {
        const elapsedMs = Math.max(event.timeStamp - current.startTime, 1);
        const delta =
          current.axis === "horizontal" ? event.clientX - current.startX : event.clientY - current.startY;
        const qualifies =
          Math.abs(delta) >= NAVIGATION_PX || Math.abs(delta) / elapsedMs >= NAVIGATION_VELOCITY_PX_MS;
        if (qualifies) {
          const direction = delta < 0 ? 1 : -1;
          if (current.axis === "horizontal") onNavigateHorizontal(direction);
          else onNavigateVertical(direction);
        }
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      gesture.current = null;
      onAxisChange(null);
    },
    [onAxisChange, onNavigateHorizontal, onNavigateVertical],
  );

  const onPointerDown = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      if (event.target.closest(INTERACTIVE_START)) return;
      gesture.current = {
        axis: null,
        pointerId: event.pointerId,
        startTime: event.timeStamp,
        startX: event.clientX,
        startY: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const onPointerMove = useCallback<PointerEventHandler<HTMLElement>>(
    (event) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - current.startX;
      const deltaY = event.clientY - current.startY;
      const absoluteX = Math.abs(deltaX);
      const absoluteY = Math.abs(deltaY);
      if (!current.axis && Math.max(absoluteX, absoluteY) >= AXIS_LOCK_PX) {
        if (absoluteX >= absoluteY * AXIS_DOMINANCE) current.axis = "horizontal";
        else if (absoluteY >= absoluteX * AXIS_DOMINANCE) current.axis = "vertical";
        if (current.axis) onAxisChange(current.axis);
      }
      if (current.axis) event.preventDefault();
    },
    [onAxisChange],
  );

  return {
    onPointerCancel: (event) => finish(event, false),
    onPointerDown,
    onPointerMove,
    onPointerUp: (event) => finish(event, true),
  };
}
