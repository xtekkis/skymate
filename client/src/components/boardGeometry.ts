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

/** Today where the reader is, as the date input writes it. */
export function todayLocal(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Where the present moment falls on the axis, or null when it is not on
 * this board at all.
 *
 * A board showing tomorrow has no now on it, and neither does one showing a
 * window that has already closed. Drawing the line anyway, parked off the
 * edge at some large negative number, is how it ends up half visible on a
 * board it has nothing to say about.
 */
/**
 * Minutes from one airport-local moment to another, counting whole days.
 *
 * The axis used to place a card by its clock alone, which is right until the
 * window crosses midnight. A 12 hour window from 20:00 carries flights at
 * 02:00 the next morning, and read as 02:00 of the same day they land nearly
 * a day to the left of the board, about 3,600 pixels past its edge.
 *
 * Sliced, never parsed, the same as everything else here. The date parts go
 * through Date.UTC as plain numbers, which is day counting and nothing more:
 * no zone is involved, so daylight saving cannot turn a day into 23 hours.
 */
export function minutesAfter(iso: string | undefined, from: string) {
  if (!iso || iso.length < 16) return 0;

  const day = (value: string) =>
    Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10))) /
    86_400_000;

  const days = day(iso) - day(from);
  if (!Number.isFinite(days)) return 0;

  return days * 1440 + minutesOfLocal(iso) - minutesOfLocal(from);
}

export function nowOffset({
  start,
  windowHours,
  date,
  now = new Date(),
}: {
  start: number;
  windowHours: number;
  /** The board own date, YYYY-MM-DD, as the date input writes it. */
  date: string;
  now?: Date;
}) {
  // Measured from when the window opens, by date as well as clock, so that
  // past midnight on a window that crosses it the present is still on the
  // board rather than a day behind it.
  const here = `${todayLocal(now)}T${hhmm(now.getHours() * 60 + now.getMinutes())}`;
  const elapsed = minutesAfter(here, `${date}T${hhmm(start)}`);

  if (elapsed < 0 || elapsed > windowHours * 60) return null;

  return offsetFor(start + elapsed, start);
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

/**
 * How tall the canvas has to be to hold every lane.
 *
 * More than the stage only once the board has overflowed its target rows,
 * which is exactly when there is somewhere to travel down to.
 */
export function contentHeight(laneCount: number) {
  return Math.max(0, laneCount) * LANE_H + GUTTER + FOOT;
}

/** How wide the canvas has to be to hold the whole window, plus the last card. */
export function contentWidth(windowHours: number) {
  return windowHours * 60 * PX_PER_MINUTE + CARD_W + GUTTER * 5;
}
