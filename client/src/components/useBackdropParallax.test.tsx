import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEPTH, useBackdropParallax } from './useBackdropParallax';

/** Frames, held rather than run, so a test decides when one happens. */
let frames: FrameRequestCallback[] = [];
let cancelled: number[] = [];
const realRaf = window.requestAnimationFrame;
const realCancel = window.cancelAnimationFrame;

beforeEach(() => {
  frames = [];
  cancelled = [];
  window.requestAnimationFrame = ((callback: FrameRequestCallback) =>
    frames.push(callback)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((handle: number) => {
    cancelled.push(handle);
  }) as typeof window.cancelAnimationFrame;

  // A window with a size, so a pointer position means something.
  Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
});

afterEach(() => {
  window.requestAnimationFrame = realRaf;
  window.cancelAnimationFrame = realCancel;
});

function Probe({ enabled }: { enabled: boolean }) {
  const layers = useBackdropParallax(enabled);

  return (
    <div>
      <div data-testid="wash" ref={layers.wash} />
      <svg data-testid="arcs" ref={layers.arcs} />
      <div data-testid="dots" ref={layers.dots} />
    </div>
  );
}

const shift = (element: HTMLElement | SVGElement) => element.style.transform;

function movePointerTo(clientX: number, clientY: number) {
  act(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY }));
  });
}

function runFrames() {
  act(() => {
    const pending = frames;
    frames = [];
    for (const frame of pending) frame(0);
  });
}

describe('the layers drifting under the pointer', () => {
  it('moves each one by its own amount', () => {
    const view = render(<Probe enabled />);

    // Three quarters across, three quarters down: 0.25 either way.
    movePointerTo(750, 600);
    runFrames();

    const wash = view.getByTestId('wash');
    expect(shift(wash)).toBe(
      `translate3d(${0.25 * DEPTH.wash.x}px, ${0.25 * DEPTH.wash.y}px, 0)`,
    );
    expect(shift(view.getByTestId('dots'))).toBe(
      `translate3d(${0.25 * DEPTH.dots.x}px, ${0.25 * DEPTH.dots.y}px, 0)`,
    );
  });

  it('sends the far layer the other way from the near one', () => {
    const view = render(<Probe enabled />);

    movePointerTo(1000, 800);
    runFrames();

    // Layers that all slide the same way read as one flat picture being
    // nudged. The opposition is the entire effect.
    expect(shift(view.getByTestId('wash')).startsWith('translate3d(-')).toBe(true);
    expect(shift(view.getByTestId('dots')).startsWith('translate3d(-')).toBe(false);
  });

  it('sits still when the pointer is in the middle', () => {
    const view = render(<Probe enabled />);

    movePointerTo(500, 400);
    runFrames();

    expect(shift(view.getByTestId('wash'))).toBe('translate3d(0px, 0px, 0)');
  });

  it('writes once however many moves land between two frames', () => {
    render(<Probe enabled />);

    movePointerTo(600, 500);
    movePointerTo(700, 550);
    movePointerTo(800, 600);

    // Three moves, one frame. Writing per move is how a pointer handler
    // turns into a layout thrash.
    expect(frames).toHaveLength(1);
  });

  it('uses the last position, not the first', () => {
    const view = render(<Probe enabled />);

    movePointerTo(600, 500);
    movePointerTo(1000, 800);
    runFrames();

    expect(shift(view.getByTestId('wash'))).toBe(
      `translate3d(${0.5 * DEPTH.wash.x}px, ${0.5 * DEPTH.wash.y}px, 0)`,
    );
  });
});

describe('when less movement was asked for', () => {
  it('schedules nothing at all', () => {
    render(<Probe enabled={false} />);

    movePointerTo(1000, 800);

    // Not a listener that returns early. Nothing attached.
    expect(frames).toHaveLength(0);
  });

  it('puts the layers back when the preference changes mid-session', () => {
    const view = render(<Probe enabled />);

    movePointerTo(1000, 800);
    runFrames();
    expect(shift(view.getByTestId('wash'))).not.toBe('');

    view.rerender(<Probe enabled={false} />);

    // Otherwise the layers stay frozen wherever the pointer left them.
    expect(shift(view.getByTestId('wash'))).toBe('');
  });
});

describe('on the way out', () => {
  it('stops listening', () => {
    const view = render(<Probe enabled />);
    view.unmount();

    movePointerTo(1000, 800);

    expect(frames).toHaveLength(0);
  });

  it('drops a frame it had already asked for', () => {
    const view = render(<Probe enabled />);

    movePointerTo(1000, 800);
    expect(frames).toHaveLength(1);

    view.unmount();

    // The callback writes to elements that are gone by then.
    expect(cancelled).toHaveLength(1);
  });
});
