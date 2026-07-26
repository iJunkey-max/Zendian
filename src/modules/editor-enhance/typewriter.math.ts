export const TYPEWRITER_ANCHOR_RATIO = 0.55;
export const TYPEWRITER_SMALL_VIEWPORT = 240;
export const TYPEWRITER_MOTION_DURATION = 100;
export const TYPEWRITER_MAX_ANIMATED_LINES = 2.5;

export interface AnchorMetrics {
  anchorLocalY: number;
  smallViewport: boolean;
}

export interface ScrollTarget {
  desiredScrollTop: number;
  appliedDelta: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateAnchor(clientHeight: number): AnchorMetrics {
  const height = Math.max(0, clientHeight);
  const smallViewport = height < TYPEWRITER_SMALL_VIEWPORT;
  if (smallViewport) {
    return {
      anchorLocalY: height * 0.5,
      smallViewport: true,
    };
  }
  return {
    anchorLocalY: clamp(height * TYPEWRITER_ANCHOR_RATIO, 72, height - 96),
    smallViewport: false,
  };
}

export function calculateScrollTarget(
  scrollTop: number,
  delta: number,
  scrollHeight: number,
  clientHeight: number,
): ScrollTarget {
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
  const desiredScrollTop = clamp(scrollTop + delta, 0, maxScrollTop);
  return {
    desiredScrollTop,
    appliedDelta: desiredScrollTop - scrollTop,
  };
}

export function calculateMotionDuration(
  appliedDelta: number,
  lineHeight: number,
  smallViewport: boolean,
  reducedMotion: boolean,
): number {
  if (smallViewport || reducedMotion) return 0;
  if (Math.abs(appliedDelta) > Math.max(1, lineHeight) * TYPEWRITER_MAX_ANIMATED_LINES) return 0;
  return Math.abs(appliedDelta) > 0.5 ? TYPEWRITER_MOTION_DURATION : 0;
}

export function mergeMotionOffset(currentOffset: number, appliedDelta: number): number {
  return currentOffset + appliedDelta;
}

export function easeOutCubic(progress: number): number {
  const normalized = clamp(progress, 0, 1);
  return 1 - Math.pow(1 - normalized, 3);
}
