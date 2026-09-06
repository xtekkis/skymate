import { describe, expect, it } from 'vitest';

import { GUTTER, PX_PER_MINUTE, clampPan, hhmm, offsetFor, toTicks } from './boardGeometry';

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
