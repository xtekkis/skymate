import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BoardStage from './BoardStage';
import { contentWidth } from './boardGeometry';

const at = (h: number, m = 0) => h * 60 + m;
const WINDOW = 4;

/** jsdom reports every element as zero wide, so the viewport has to be said. */
function board(viewport = 900) {
  const view = render(
    <BoardStage start={at(8)} windowHours={WINDOW}>
      <button type="button">a card</button>
    </BoardStage>,
  );

  const stage = view.container.querySelector<HTMLElement>('.stage')!;
  Object.defineProperty(stage, 'clientWidth', { value: viewport, configurable: true });

  return {
    stage,
    canvas: view.container.querySelector<HTMLElement>('.stage__canvas')!,
    ruler: view.container.querySelector<HTMLElement>('.stage__rulerInner')!,
    card: view.getByRole('button', { name: 'a card' }),
  };
}

/** The x out of a translate3d, as a number. */
const xOf = (el: HTMLElement) => Number(/translate3d\((-?[\d.]+)px/.exec(el.style.transform)?.[1]);

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

  it('carries the ruler along with it', () => {
    const { stage, canvas, ruler } = board();

    drag(stage, 600, 450);

    // The hours have to stay over the cards they are labelling.
    expect(ruler.style.transform).toBe(canvas.style.transform);
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

describe('what it leaves alone', () => {
  it('does not start a drag from a control sitting on the board', () => {
    const { stage, canvas, card } = board();

    fireEvent.pointerDown(card, { clientX: 600 });
    fireEvent.pointerMove(window, { clientX: 300 });

    // A card is a button. Pressing one must not drag the board out from under
    // the press.
    expect(canvas.style.transform).toBe('');
    expect(stage).toBeTruthy();
  });

  it('stops listening once the stage goes away', () => {
    const view = render(<BoardStage start={at(8)} windowHours={WINDOW} />);
    const stage = view.container.querySelector<HTMLElement>('.stage')!;

    fireEvent.pointerDown(stage, { clientX: 600 });
    view.unmount();

    // A window listener outlives the component that added it, and this one
    // writes to a node that is no longer in the document.
    expect(() => fireEvent.pointerMove(window, { clientX: 100 })).not.toThrow();
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
    expect(canvas.style.transform).toBe('');
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
