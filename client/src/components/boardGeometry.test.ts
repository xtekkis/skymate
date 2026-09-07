import { describe, expect, it } from 'vitest';

import {
  CARD_GAP,
  CARD_W,
  GUTTER,
  LANE_H,
  MAX_LANES,
  MIN_LANES,
  PX_PER_MINUTE,
  assignLanes,
  clampPan,
  hhmm,
  laneCountFor,
  laneTop,
  offsetFor,
  toTicks,
} from './boardGeometry';

/**
 * The obvious alternative, written out so a test can show why it is not the
 * one used: it fills the first lane that has cleared, and a board of hourly
 * departures collapses into two rows because lane zero keeps clearing in time.
 */
function fillFirstFree(minutes: number[], start: number, lanes: number) {
  const ends: number[] = new Array(lanes).fill(Number.NEGATIVE_INFINITY);

  return minutes.map((at) => {
    const left = offsetFor(at, start);
    let lane = ends.findIndex((end) => end <= left - CARD_GAP);

    if (lane === -1) {
      lane = ends.length;
      ends.push(Number.NEGATIVE_INFINITY);
    }

    ends[lane] = left + CARD_W;
    return lane;
  });
}

const at = (h: number, m = 0) => h * 60 + m;

describe('reading minutes as a wall clock', () => {
  it('pads both halves', () => {
    expect(hhmm(at(9, 5))).toBe('09:05');
    expect(hhmm(at(21, 30))).toBe('21:30');
    expect(hhmm(0)).toBe('00:00');
  });

  it('wraps past midnight rather than running to 25:00', () => {
    // A twelve hour window opening at 21:00 ends the next morning, and the
    // ruler has to say 09:00 rather than 33:00.
    expect(hhmm(at(33))).toBe('09:00');
    expect(hhmm(at(24))).toBe('00:00');
  });
});

describe('placing a moment on the axis', () => {
  it('starts a window at the gutter, not at the edge', () => {
    expect(offsetFor(at(8), at(8))).toBe(GUTTER);
  });

  it('scales by the minute', () => {
    expect(offsetFor(at(9), at(8))).toBe(Math.round(60 * PX_PER_MINUTE) + GUTTER);
  });
});

describe('the ruler', () => {
  it('marks every half hour of the window', () => {
    const ticks = toTicks(at(8), 4);

    // 08:00 through 12:00 inclusive.
    expect(ticks).toHaveLength(9);
    expect(hhmm(ticks[0].at)).toBe('08:00');
    expect(hhmm(ticks.at(-1)!.at)).toBe('12:00');
  });

  it('labels the hours and leaves the half hours bare', () => {
    const ticks = toTicks(at(8), 2);

    expect(ticks.filter((tick) => tick.onTheHour).map((tick) => tick.label)).toEqual([
      '08:00',
      '09:00',
      '10:00',
    ]);
    // A label every thirty minutes is a wall of numbers, not a ruler.
    expect(ticks.filter((tick) => !tick.onTheHour).every((tick) => tick.label === '')).toBe(true);
  });

  it('puts the hour marks on real hours, not on the window start', () => {
    const ticks = toTicks(at(21, 20), 2);

    // The window opens at 21:20, so the first tick is 21:30 and the hours are
    // still where a reader looks for them.
    expect(hhmm(ticks[0].at)).toBe('21:30');
    expect(ticks.filter((tick) => tick.onTheHour).map((tick) => tick.label)).toEqual([
      '22:00',
      '23:00',
    ]);
  });

  it('carries the labels across midnight', () => {
    const ticks = toTicks(at(23), 2);

    expect(ticks.map((tick) => tick.label).filter(Boolean)).toEqual(['23:00', '00:00', '01:00']);
  });

  it('spaces the ticks by the same scale everything else uses', () => {
    const ticks = toTicks(at(8), 1);

    expect(ticks[1].left - ticks[0].left).toBe(Math.round(30 * PX_PER_MINUTE));
  });
});

describe('how far a pan may travel', () => {
  it('will not go back past the start', () => {
    expect(clampPan(240, 900, 4000)).toBe(0);
  });

  it('stops once the last of the content is on screen', () => {
    // Not at -4000: the viewport is already showing 900 of it.
    expect(clampPan(-9000, 900, 4000)).toBe(-3100);
  });

  it('leaves anything in between alone', () => {
    expect(clampPan(-1200, 900, 4000)).toBe(-1200);
  });

  it('refuses to move when it all fits already', () => {
    // Both ends collapse onto zero, so there is nowhere to go.
    expect(clampPan(-500, 4000, 900)).toBe(0);
    expect(clampPan(500, 4000, 900)).toBe(0);
  });
});

describe('how many rows the stage can show', () => {
  it('never goes below three, however short the stage', () => {
    // Two rows on a laptop is a list with extra steps.
    expect(laneCountFor(200)).toBe(MIN_LANES);
    expect(laneCountFor(0)).toBe(MIN_LANES);
  });

  it('never goes above six, however tall', () => {
    // Past six the eye stops reading rows and starts scanning a wall.
    expect(laneCountFor(4000)).toBe(MAX_LANES);
  });

  it('fits as many whole lanes as the space between the ruler and the foot', () => {
    // 46 for the ruler, 40 for the scrubber, 116 a lane: this holds four.
    expect(laneCountFor(46 + 40 + LANE_H * 4)).toBe(4);
    expect(laneCountFor(46 + 40 + LANE_H * 4 - 1)).toBe(3);
  });
});

describe('dealing cards into rows', () => {
  const start = at(8);
  /** Far enough apart that a lane has cleared by the time it comes round. */
  const hourly = [at(8), at(9), at(10), at(11), at(12), at(13)];

  it('deals round-robin, so every lane gets used', () => {
    expect(assignLanes(hourly, start, 3)).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it('spreads where filling the first free lane would not', () => {
    // The point of the whole function. A greedy pass over this same input
    // finds lane 0 clear by the third card and puts it there, and again for
    // the fifth, so the board uses two rows and the bottom half sits empty.
    const greedy = fillFirstFree(hourly, start, 3);

    expect(new Set(greedy).size).toBe(2);
    expect(new Set(assignLanes(hourly, start, 3)).size).toBe(3);
  });

  it('passes over a lane whose last card is still in the way', () => {
    // Four departures inside a few minutes, dealt into three lanes: the fourth
    // cannot go back to lane 0, which is still holding the first.
    const bunched = [at(8), at(8, 2), at(8, 4), at(8, 6)];

    expect(assignLanes(bunched, start, 3)).toEqual([0, 1, 2, 3]);
  });

  it('adds a row when every lane is occupied', () => {
    const bunched = [at(8), at(8, 1), at(8, 2), at(8, 3), at(8, 4)];
    const lanes = assignLanes(bunched, start, 3);

    // Beyond the target, which is what gives the stage something to scroll to.
    expect(Math.max(...lanes)).toBeGreaterThan(2);
  });

  it('gives every card a lane, and never a negative one', () => {
    const lanes = assignLanes(hourly, start, 3);

    expect(lanes).toHaveLength(hourly.length);
    expect(lanes.every((lane) => Number.isInteger(lane) && lane >= 0)).toBe(true);
  });

  it('has nothing to say about an empty board', () => {
    expect(assignLanes([], start, 3)).toEqual([]);
  });

  it('survives being asked for no lanes at all', () => {
    expect(assignLanes(hourly, start, 0).every((lane) => lane >= 0)).toBe(true);
  });
});

describe('where a lane sits', () => {
  it('stacks by the lane height, below the gutter', () => {
    expect(laneTop(0)).toBe(GUTTER);
    expect(laneTop(2) - laneTop(1)).toBe(LANE_H);
  });
});
