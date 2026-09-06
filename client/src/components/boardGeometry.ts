/**
 * Where things sit on the board.
 *
 * The board is a time axis drawn in pixels, so every position on it comes from
 * one conversion: minutes since the window opened, times a scale, plus a
 * gutter. Kept apart from the component because it is arithmetic, and because
 * arithmetic is worth testing without rendering anything.
 */

/** The ruler's height. The canvas below it starts here. */
export const RULER_H = 46;

/** One row of cards, including the space under it. */
export const LANE_H = 116;

export const CARD_W = 244;

/** How wide an hour is. Three and a bit pixels a minute reads as a morning. */
export const PX_PER_MINUTE = 3.4;

/** Breathing room before the first tick, so it is not flush to the edge. */
export const GUTTER = 24;

/** A tick every half hour; the ones on the hour are the ones that say so. */
export const TICK_MINUTES = 30;

export interface Tick {
  /** Minutes since midnight, which is what the label is made from. */
  at: number;
  left: number;
  /** Empty on the half hours: a label every 30 minutes is a wall of numbers. */
  label: string;
  onTheHour: boolean;
}

/** Minutes since midnight as a wall clock, wrapping past midnight. */
export function hhmm(minutes: number) {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  return `${String(h).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** How far along the axis a moment sits, in pixels from the canvas origin. */
export function offsetFor(minutes: number, start: number) {
  return Math.round((minutes - start) * PX_PER_MINUTE) + GUTTER;
}

/**
 * The ruler.
 *
 * Ticks are placed on real clock half hours rather than every 30 minutes from
 * the window's start, so a window opening at 21:20 still puts its hour marks
 * at 22:00 and 23:00 where a reader expects them.
 */
export function toTicks(start: number, windowHours: number): Tick[] {
  const total = windowHours * 60;
  const ticks: Tick[] = [];

  const first = Math.ceil(start / TICK_MINUTES) * TICK_MINUTES;

  for (let at = first; at <= start + total; at += TICK_MINUTES) {
    const onTheHour = at % 60 === 0;
    ticks.push({ at, left: offsetFor(at, start), label: onTheHour ? hhmm(at) : '', onTheHour });
  }

  return ticks;
}

/**
 * Where a pan is allowed to sit.
 *
 * Zero is the window's start, and there is nothing before it. The far end is
 * whatever is left once the viewport has taken its share, and when the content
 * is narrower than the viewport there is nowhere to go at all.
 */
export function clampPan(value: number, viewport: number, content: number) {
  const furthest = Math.min(0, viewport - content);
  return Math.max(furthest, Math.min(0, value));
}

/** How wide the canvas has to be to hold the whole window, plus the last card. */
export function contentWidth(windowHours: number) {
  return windowHours * 60 * PX_PER_MINUTE + CARD_W + GUTTER * 5;
}
