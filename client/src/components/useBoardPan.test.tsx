import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BoardStage from './BoardStage';
import { LANE_H, PX_PER_MINUTE, RULER_H, contentWidth } from './boardGeometry';
import { STEP_MINUTES, THUMB_MIN } from './useBoardPan';

const at = (h: number, m = 0) => h * 60 + m;
const WINDOW = 4;

/** The scrubber's groove, given a size jsdom will not invent for it. */
const TRACK_W = 400;
const TRACK_X = 100;

/** jsdom reports every element as zero wide, so the viewport has to be said. */
function board(viewport = 900) {
  const view = render(
    <BoardStage start={at(8)} windowHours={WINDOW}>
      <button type="button">a card</button>
    </BoardStage>,
  );

  const stage = view.container.querySelector<HTMLElement>('.stage')!;
  Object.defineProperty(stage, 'clientWidth', { value: viewport, configurable: true });

  /*
   * jsdom gives every element a zero box, so the groove has to be told how
   * wide it is and where it starts. Without this a scrub divides by zero.
   */
  const track = view.container.querySelector<HTMLElement>('.stage__track')!;
  Object.defineProperty(track, 'clientWidth', { value: TRACK_W, configurable: true });
  track.getBoundingClientRect = () =>
    ({ left: TRACK_X, width: TRACK_W, right: TRACK_X + TRACK_W, top: 0, bottom: 0, height: 6, x: TRACK_X, y: 0, toJSON: () => ({}) }) as DOMRect;

  /*
   * The hook measures on mount, which in here is before any of the sizes
   * above were defined. A browser has laid the page out by then; jsdom has
   * not, so it is told to measure again.
   */
  fireEvent(window, new Event('resize'));

  return {
    stage,
    canvas: view.container.querySelector<HTMLElement>('.stage__canvas')!,
    ruler: view.container.querySelector<HTMLElement>('.stage__rulerInner')!,
    card: view.getByRole('button', { name: 'a card' }),
    track,
    thumb: view.container.querySelector<HTMLElement>('.stage__thumb')!,
  };
}

/**
 * The x out of a translate3d, as a number.
 *
 * Always present: the pan writes its position once on mount so the scrubber
 * thumb has a size before anything has been moved. Not moved therefore means
 * zero, not the absence of a style.
 */
const xOf = (el: HTMLElement) => Number(/translate3d\((-?[\d.]+)px/.exec(el.style.transform)?.[1]);

/** And the y, which for the ruler must never be anything but zero. */
const yOf = (el: HTMLElement) =>
  Number(/translate3d\(-?[\d.]+px,\s*(-?[\d.]+)(?:px)?/.exec(el.style.transform)?.[1]);

function drag(stage: HTMLElement, from: number, to: number) {
  fireEvent.pointerDown(stage, { clientX: from });
  fireEvent.pointerMove(window, { clientX: to });
}

describe('dragging the board', () => {
  it('moves the canvas by the distance the pointer moved', () => {
    const { stage, canvas } = board();

    drag(stage, 600, 400);

    expect(xOf(canvas)).toBe(-200);
  });

  it('carries the ruler sideways with it', () => {
    const { stage, canvas, ruler } = board();

    drag(stage, 600, 450);

    // The hours have to stay over the cards they are labelling.
    expect(xOf(ruler)).toBe(xOf(canvas));
  });

  it('continues from where the last drag left off', () => {
    const { stage, canvas } = board();

    drag(stage, 600, 500);
    fireEvent.pointerUp(window);
    drag(stage, 600, 540);

    expect(xOf(canvas)).toBe(-160);
  });

  it('stops moving once the pointer is released', () => {
    const { stage, canvas } = board();

    drag(stage, 600, 500);
    fireEvent.pointerUp(window);
    fireEvent.pointerMove(window, { clientX: 100 });

    expect(xOf(canvas)).toBe(-100);
  });
});

describe('where it is allowed to go', () => {
  it('will not travel back before the start of the window', () => {
    const { stage, canvas } = board();

    drag(stage, 400, 900);

    // There is nothing earlier than the window's first minute.
    expect(xOf(canvas)).toBe(0);
  });

  it('stops at the end of the content rather than into empty space', () => {
    const viewport = 900;
    const { stage, canvas } = board(viewport);

    drag(stage, 5000, 0);

    expect(xOf(canvas)).toBe(Math.min(0, viewport - contentWidth(WINDOW)));
  });

  it('does not move at all when everything already fits', () => {
    const { stage, canvas } = board(contentWidth(WINDOW) + 500);

    drag(stage, 600, 100);

    expect(xOf(canvas)).toBe(0);
  });
});

describe('travelling down the lanes', () => {
  const TALL = 2000;

  /** A stage with more card below it than fits, so there is somewhere to go. */
  function overflowing(viewportHeight = 600) {
    const view = render(
      <BoardStage start={at(8)} windowHours={WINDOW} contentHeight={TALL}>
        <button type="button">a card</button>
      </BoardStage>,
    );

    const stage = view.container.querySelector<HTMLElement>('.stage')!;
    Object.defineProperty(stage, 'clientWidth', { value: 900, configurable: true });
    Object.defineProperty(stage, 'clientHeight', { value: viewportHeight, configurable: true });

    return {
      stage,
      canvas: view.container.querySelector<HTMLElement>('.stage__canvas')!,
      ruler: view.container.querySelector<HTMLElement>('.stage__rulerInner')!,
    };
  }

  /** Drag with both axes, since a real hand never moves on one alone. */
  function dragTo(stage: HTMLElement, from: [number, number], to: [number, number]) {
    fireEvent.pointerDown(stage, { clientX: from[0], clientY: from[1] });
    fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1] });
  }

  it('pulls the lower lanes into view', () => {
    const { stage, canvas } = overflowing();

    dragTo(stage, [600, 500], [600, 300]);

    // Cards past the rows that fit are placed and reachable rather than
    // stranded off the bottom of a board that only moves sideways.
    expect(yOf(canvas)).toBe(-200);
  });

  it('will not pull the first lane down past the ruler', () => {
    const { stage, canvas } = overflowing();

    dragTo(stage, [600, 300], [600, 700]);

    expect(yOf(canvas)).toBe(0);
  });

  it('stops at the last lane rather than into empty space', () => {
    const viewportHeight = 600;
    const { stage, canvas } = overflowing(viewportHeight);

    dragTo(stage, [600, 5000], [600, 0]);

    // What is left once the ruler and the visible rows have taken their share.
    expect(yOf(canvas)).toBe(viewportHeight - RULER_H - TALL);
  });

  it('leaves the ruler exactly where it is', () => {
    const { stage, ruler } = overflowing();

    dragTo(stage, [600, 500], [500, 300]);

    // It slides sideways with the cards and never up or down with them, or
    // the clock leaves the top of the stage.
    expect(yOf(ruler)).toBe(0);
    expect(xOf(ruler)).toBe(-100);
  });

  it('does not move vertically when the lanes already fit', () => {
    const { stage, canvas } = board();

    dragTo(stage, [600, 500], [600, 200]);

    expect(yOf(canvas)).toBe(0);
  });
});

describe('grabbing the board by a card', () => {
  /** A stage carrying a card and something that has opted out of panning. */
  function withCard(viewport = 900) {
    const onCardClick = vi.fn();

    const view = render(
      <BoardStage start={at(8)} windowHours={WINDOW}>
        <button type="button" onClick={onCardClick}>
          a card
        </button>
        <div data-no-pan>
          <button type="button">the scrubber</button>
        </div>
      </BoardStage>,
    );

    const stage = view.container.querySelector<HTMLElement>('.stage')!;
    Object.defineProperty(stage, 'clientWidth', { value: viewport, configurable: true });

    return {
      stage,
      canvas: view.container.querySelector<HTMLElement>('.stage__canvas')!,
      card: view.getByRole('button', { name: 'a card' }),
      optedOut: view.getByRole('button', { name: 'the scrubber' }),
      onCardClick,
    };
  }

  it('drags from a card, because cards cover the board', () => {
    const { stage, canvas, card } = withCard();

    fireEvent.pointerDown(card, { clientX: 600 });
    fireEvent.pointerMove(window, { clientX: 400 });

    // Every card is a button. Refusing to drag from one leaves almost nowhere
    // on the board to grab.
    expect(xOf(canvas)).toBe(-200);
    expect(stage).toBeTruthy();
  });

  it('does not drag from something that has opted out', () => {
    const { canvas, optedOut } = withCard();

    fireEvent.pointerDown(optedOut, { clientX: 600 });
    fireEvent.pointerMove(window, { clientX: 400 });

    expect(xOf(canvas)).toBe(0);
  });

  it('does not open a card that was only dragged across', () => {
    const { card, onCardClick } = withCard();

    fireEvent.pointerDown(card, { clientX: 600 });
    fireEvent.pointerMove(window, { clientX: 400 });
    fireEvent.pointerUp(window);
    fireEvent.click(card);

    // The release produces a click, and without swallowing it every sweep
    // across the board would open whatever it ended on.
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('still opens a card that was pressed rather than dragged', () => {
    const { card, onCardClick } = withCard();

    fireEvent.pointerDown(card, { clientX: 600 });
    fireEvent.pointerMove(window, { clientX: 602 });
    fireEvent.pointerUp(window);
    fireEvent.click(card);

    // Two pixels is a press with a shaky hand, not a drag.
    expect(onCardClick).toHaveBeenCalledTimes(1);
  });

  it('swallows one click and not the next one', () => {
    const { card, onCardClick } = withCard();

    fireEvent.pointerDown(card, { clientX: 600 });
    fireEvent.pointerMove(window, { clientX: 400 });
    fireEvent.pointerUp(window);
    fireEvent.click(card);

    fireEvent.pointerDown(card, { clientX: 400 });
    fireEvent.pointerUp(window);
    fireEvent.click(card);

    // A drag that ends off the board produces no click at all, and a listener
    // left waiting for one would eat the next real press instead.
    expect(onCardClick).toHaveBeenCalledTimes(1);
  });

  it('stops listening once the stage goes away', () => {
    const view = render(<BoardStage start={at(8)} windowHours={WINDOW} />);
    const stage = view.container.querySelector<HTMLElement>('.stage')!;

    fireEvent.pointerDown(stage, { clientX: 600 });
    view.unmount();

    expect(() => fireEvent.pointerMove(window, { clientX: 100 })).not.toThrow();
  });
});

describe('scrolling over the board', () => {
  /** Cancelable and constructed by hand, so defaultPrevented can be read. */
  function wheel(stage: HTMLElement, deltas: { deltaX?: number; deltaY?: number }) {
    const event = new WheelEvent('wheel', {
      deltaX: 0,
      deltaY: 0,
      ...deltas,
      cancelable: true,
      bubbles: true,
    });
    stage.dispatchEvent(event);
    return event;
  }

  it('turns a mouse wheel into travel through time', () => {
    const { stage, canvas } = board();

    wheel(stage, { deltaY: 120 });

    // A wheel only has a y, and the board only moves in x.
    expect(xOf(canvas)).toBe(-120);
  });

  it('takes a trackpad swipe on its own axis', () => {
    const { stage, canvas } = board();

    wheel(stage, { deltaX: 90, deltaY: 12 });

    // Whichever axis the gesture is mostly on is the one that counts.
    expect(xOf(canvas)).toBe(-90);
  });

  it('keeps the page from scrolling underneath', () => {
    const { stage } = board();

    // The board has taken the gesture, so nothing else may act on it. This is
    // the whole reason the listener is native rather than React's onWheel.
    expect(wheel(stage, { deltaY: 120 }).defaultPrevented).toBe(true);
  });

  it('obeys the same ends as a drag', () => {
    const { stage, canvas } = board();

    wheel(stage, { deltaY: -400 });

    expect(xOf(canvas)).toBe(0);
  });

  it('stops a board that is still gliding', async () => {
    const { stage, canvas } = board();

    fireEvent.pointerDown(stage, { clientX: 700 });
    fireEvent.pointerMove(window, { clientX: 620 });
    fireEvent.pointerMove(window, { clientX: 540 });
    fireEvent.pointerUp(window);
    await waitFor(() => expect(xOf(canvas)).toBeLessThan(-160));

    wheel(stage, { deltaY: 10 });
    const caught = xOf(canvas);
    await new Promise((resolve) => setTimeout(resolve, 120));

    // Scrolling into a moving board takes it over rather than fighting it.
    expect(xOf(canvas)).toBe(caught);
  });
});

describe('letting go mid sweep', () => {
  /** A flick: two moves, so there is a per-frame delta to carry on with. */
  function flick(stage: HTMLElement) {
    fireEvent.pointerDown(stage, { clientX: 700 });
    fireEvent.pointerMove(window, { clientX: 620 });
    fireEvent.pointerMove(window, { clientX: 540 });
    fireEvent.pointerUp(window);
  }

  /** Long enough for several real animation frames to have gone by. */
  const aFewFrames = () => new Promise((resolve) => setTimeout(resolve, 120));

  /** Polls until two reads agree, which is the glide having come to rest. */
  async function restingPlace(canvas: HTMLElement) {
    let previous = Number.NaN;

    await waitFor(
      () => {
        const now = xOf(canvas);
        const stopped = now === previous;
        previous = now;
        expect(stopped).toBe(true);
      },
      { timeout: 4000, interval: 60 },
    );

    return previous;
  }

  it('keeps travelling after the pointer has gone', async () => {
    const { stage, canvas } = board();

    flick(stage);
    const atRelease = xOf(canvas);

    // Stopping dead reads as the gesture being dropped rather than finished.
    await waitFor(() => expect(xOf(canvas)).toBeLessThan(atRelease));
  });

  it('settles instead of running forever', async () => {
    const { stage, canvas } = board();

    flick(stage);
    const rest = await restingPlace(canvas);
    await aFewFrames();

    expect(xOf(canvas)).toBe(rest);
  });

  it('does not glide from a press that never moved', async () => {
    const { stage, canvas } = board();

    fireEvent.pointerDown(stage, { clientX: 600 });
    fireEvent.pointerUp(window);
    await aFewFrames();

    // A card is under that press and about to be opened. Nothing may slide
    // out from under it.
    expect(xOf(canvas)).toBe(0);
  });

  it('stops when the board is caught again', async () => {
    const { stage, canvas } = board();

    flick(stage);
    await waitFor(() => expect(xOf(canvas)).toBeLessThan(-160));

    fireEvent.pointerDown(stage, { clientX: 400 });
    const caught = xOf(canvas);
    await aFewFrames();

    // Catching a thing that is still travelling stops it.
    expect(xOf(canvas)).toBe(caught);
  });

  it('drops the frame loop when the stage goes away', async () => {
    // Counting requests, not cancellations: the hook cancels on every press
    // and at the top of every glide, so a spy on cancel is satisfied whether
    // or not the cleanup does its job.
    const raf = vi.spyOn(window, 'requestAnimationFrame');

    const view = render(<BoardStage start={at(8)} windowHours={WINDOW} />);
    const stage = view.container.querySelector<HTMLElement>('.stage')!;
    Object.defineProperty(stage, 'clientWidth', { value: 900, configurable: true });

    flick(stage);
    view.unmount();
    const asked = raf.mock.calls.length;
    await aFewFrames();

    // A loop left running keeps asking for frames forever, long after it has
    // nothing left to write to.
    expect(raf.mock.calls.length).toBe(asked);
    raf.mockRestore();
  });
});

describe('panning from the keyboard', () => {
  /** What one press of an arrow is worth sideways. */
  const step = STEP_MINUTES * PX_PER_MINUTE;

  function press(stage: HTMLElement, key: string, target?: HTMLElement) {
    fireEvent.keyDown(target ?? stage, { key });
  }

  it('is reachable by tab at all', () => {
    const { stage } = board();

    // Without this the only ways through the window are a wheel and a drag.
    expect(stage.getAttribute('tabindex')).toBe('0');
  });

  it('moves forward half an hour at a time', () => {
    const { stage, canvas } = board();

    press(stage, 'ArrowRight');

    expect(xOf(canvas)).toBe(-step);
  });

  it('carries the ruler with it, the same as a drag does', () => {
    const { stage, canvas, ruler } = board();

    press(stage, 'ArrowRight');

    expect(xOf(ruler)).toBe(xOf(canvas));
  });

  it('stops at the start rather than running past it', () => {
    const { stage, canvas } = board();

    press(stage, 'ArrowLeft');

    // Already at the left edge, so there is nowhere to go.
    expect(xOf(canvas)).toBe(0);
  });

  it('goes to the far end in one press', () => {
    const { stage, canvas } = board();

    press(stage, 'End');

    expect(xOf(canvas)).toBe(900 - contentWidth(WINDOW));
  });

  it('and back to the beginning in one', () => {
    const { stage, canvas } = board();

    press(stage, 'End');
    press(stage, 'Home');

    expect(xOf(canvas)).toBe(0);
  });

  it('moves a screen at a time on page down', () => {
    // A narrow viewport on purpose: against a 900px one a four hour window
    // has less than a screen of travel in it, so this would clamp to the end
    // and prove nothing that End does not already prove.
    const { stage, canvas } = board(300);

    press(stage, 'PageDown');

    expect(xOf(canvas)).toBe(-300);
  });

  it('moves a lane at a time vertically', () => {
    const { stage, canvas } = board(900);
    Object.defineProperty(stage, 'clientHeight', { value: RULER_H + LANE_H, configurable: true });

    press(stage, 'ArrowDown');

    // One lane down, or as far as the lanes that overflowed allow.
    expect(yOf(canvas)).toBeLessThanOrEqual(0);
  });

  it('leaves the board alone when a card has focus', () => {
    const { stage, canvas, card } = board();

    press(stage, 'ArrowRight', card);

    // A card is a button. Arrows pressed on one belong to whatever the
    // reader is doing there, not to the board underneath it.
    expect(xOf(canvas)).toBe(0);
  });

  it('lets every other key through', () => {
    const { stage } = board();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    stage.dispatchEvent(event);

    // Swallowing keys it does not handle is how a board eats Tab and traps
    // anyone moving through the page.
    expect(event.defaultPrevented).toBe(false);
  });

  it('takes the keys it does handle', () => {
    const { stage } = board();

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    stage.dispatchEvent(event);

    // Or the page scrolls sideways underneath the board as well.
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('the scrubber', () => {
  /** How far the board can travel, which is what the groove stands for. */
  const travel = (viewport: number) => contentWidth(WINDOW) - viewport;

  function scrub(track: HTMLElement, clientX: number) {
    fireEvent.pointerDown(track, { clientX });
    fireEvent.pointerUp(window, { clientX });
  }

  it('takes the board to the far end when pressed at the far end', () => {
    const { track, canvas } = board();

    scrub(track, TRACK_X + TRACK_W);

    expect(xOf(canvas)).toBe(-travel(900));
  });

  it('takes it back to the start when pressed at the start', () => {
    const { track, canvas } = board();

    scrub(track, TRACK_X + TRACK_W);
    scrub(track, TRACK_X);

    expect(xOf(canvas)).toBe(0);
  });

  it('lands halfway for a press halfway', () => {
    const { track, canvas } = board();

    scrub(track, TRACK_X + TRACK_W / 2);

    expect(xOf(canvas)).toBe(-travel(900) / 2);
  });

  it('stays inside the groove however far past it the pointer goes', () => {
    const { track, canvas } = board();

    scrub(track, TRACK_X + TRACK_W * 4);
    expect(xOf(canvas)).toBe(-travel(900));

    scrub(track, TRACK_X - 900);
    expect(xOf(canvas)).toBe(0);
  });

  it('keeps moving while the pointer is held down and slides', () => {
    const { track, canvas } = board();

    fireEvent.pointerDown(track, { clientX: TRACK_X });
    fireEvent.pointerMove(window, { clientX: TRACK_X + TRACK_W / 2 });

    expect(xOf(canvas)).toBe(-travel(900) / 2);
  });

  it('stops following once the pointer is let go', () => {
    const { track, canvas } = board();

    fireEvent.pointerDown(track, { clientX: TRACK_X });
    fireEvent.pointerUp(window, { clientX: TRACK_X });
    fireEvent.pointerMove(window, { clientX: TRACK_X + TRACK_W });

    expect(xOf(canvas)).toBe(0);
  });

  it('does not drag the board as well as scrub it', () => {
    const { track, canvas } = board();

    fireEvent.pointerDown(track, { clientX: TRACK_X });
    fireEvent.pointerMove(window, { clientX: TRACK_X - 200 });

    // The groove is inside the stage. Without the scrub claiming the press,
    // one pointer down would start a scrub and a drag at once.
    expect(xOf(canvas)).toBe(0);
  });

  it('shows how much of the window is on screen', () => {
    const { thumb } = board();

    // 900 of a 1180px board, so most of the groove.
    const expected = (900 / contentWidth(WINDOW)) * TRACK_W;
    expect(Math.round(parseFloat(thumb.style.width))).toBe(Math.round(expected));
  });

  it('never shrinks to something too small to grab', () => {
    const { thumb } = board(30);

    // A narrow stage on a long window works out at a few pixels otherwise.
    expect(parseFloat(thumb.style.width)).toBe(THUMB_MIN);
  });

  it('moves the thumb as the board moves', () => {
    const { stage, thumb } = board();

    const before = parseFloat(thumb.style.left);
    fireEvent.keyDown(stage, { key: 'End' });

    expect(parseFloat(thumb.style.left)).toBeGreaterThan(before);
  });

  it('puts the thumb at the end of the groove when the board is at its end', () => {
    const { stage, thumb } = board();

    fireEvent.keyDown(stage, { key: 'End' });

    const width = parseFloat(thumb.style.width);
    expect(Math.round(parseFloat(thumb.style.left))).toBe(Math.round(TRACK_W - width));
  });

  it('has a thumb before anything has been moved at all', () => {
    const { thumb } = board();

    // Written on mount, or the scrubber is an empty groove until the first
    // drag and reads as broken.
    expect(thumb.style.width).not.toBe('');
  });
});
