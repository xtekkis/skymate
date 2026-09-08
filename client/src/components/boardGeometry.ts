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
 * The wall clock minute an airport-local string names.
 *
 * Sliced, never parsed. "2026-09-04T08:45+01:00" is a quarter to nine at the
 * airport, and turning it into a Date would make it a different time for every
 * reader. A flight with no scheduled time cannot be placed on a time axis at
 * all; the server drops those before they reach us, so this puts anything that
 * slipped through at the start of the window rather than at NaN.
 */
export function minutesOfLocal(iso?: string) {
  if (!iso || iso.length < 16) return 0;

  const hours = Number(iso.slice(11, 13));
  const minutes = Number(iso.slice(14, 16));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;

  return hours * 60 + minutes;
}

/** Clear space a card needs before it, or the one before is still in the way. */
export const CARD_GAP = 12;

/** Room kept at the foot of the stage, where the scrubber sits. */
export const FOOT = 40;

/** Fewer than three rows is a list; more than six is a wall. */
export const MIN_LANES = 3;
export const MAX_LANES = 6;

/** How many rows the stage can show without having to be scrolled. */
export function laneCountFor(stageHeight: number) {
  const usable = stageHeight - RULER_H - FOOT;
  return Math.max(MIN_LANES, Math.min(MAX_LANES, Math.floor(usable / LANE_H)));
}

/**
 * Which row each card goes in.
 *
 * Dealt round-robin rather than into the first lane that happens to be free.
 * Greedy packing is the obvious way and it is wrong here: cards are wider than
 * the gap between departures, so the first lane clears just in time to take
 * the next one, and a full board collapses into two or three rows with the
 * bottom half of the screen empty.
 *
 * Round-robin spreads them, and only reaches for another lane when the one it
 * was dealt is genuinely still occupied. If every lane is, a new one is added
 * and the stage gains something to scroll to.
 */
export function assignLanes(minutes: number[], start: number, lanes: number) {
  const target = Math.max(1, lanes);
  /** How far right each lane is committed to, so far. */
  const ends: number[] = new Array(target).fill(Number.NEGATIVE_INFINITY);

  return minutes.map((at, index) => {
    const left = offsetFor(at, start);
    let lane = index % target;

    if (ends[lane] > left - CARD_GAP) {
      const free = ends.findIndex((end) => end <= left - CARD_GAP);

      if (free === -1) {
        lane = ends.length;
        ends.push(Number.NEGATIVE_INFINITY);
      } else {
        lane = free;
      }
    }

    ends[lane] = left + CARD_W;
    return lane;
  });
}

/** The top of a lane, in pixels down the canvas. */
export function laneTop(lane: number) {
  return lane * LANE_H + GUTTER;
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
