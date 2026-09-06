import { useEffect, useRef, type RefObject } from 'react';

import { clampPan } from './boardGeometry';

interface BoardPanOptions {
  stageRef: RefObject<HTMLElement | null>;
  canvasRef: RefObject<HTMLElement | null>;
  rulerRef: RefObject<HTMLElement | null>;
  /** How wide the canvas is, which is how far there is to travel. */
  contentWidth: number;
}

/** Past this, a pointer was dragging the board rather than clicking a card. */
export const DRAG_SLOP = 4;

/** What a flick keeps, frame to frame, once the pointer has gone. */
export const DECAY = 0.92;

/** Below a quarter of a pixel a frame there is nothing left to see. */
export const MIN_VELOCITY = 0.25;

/**
 * Dragging the board.
 *
 * Nothing here is state. The offset changes on every pointer move, and a
 * component that re-rendered on each of those would be rebuilding a board of
 * cards sixty times a second to move it four pixels. The position is written
 * straight to two transforms instead, which keeps the whole gesture on the
 * compositor.
 *
 * Returns a ref reporting whether the last gesture actually moved, so a card
 * can tell a click from the end of a drag across it.
 */
export function useBoardPan({ stageRef, canvasRef, rulerRef, contentWidth }: BoardPanOptions) {
  const pan = useRef(0);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const moved = useRef(false);
  const velocity = useRef(0);
  const frame = useRef(0);

  // Read inside the listeners rather than captured, so a window change does
  // not need the listeners torn down and rebuilt.
  const width = useRef(contentWidth);
  width.current = contentWidth;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function apply(next: number) {
      const view = stageRef.current?.clientWidth ?? 0;
      pan.current = clampPan(next, view, width.current);

      const offset = `translate3d(${pan.current}px, 0, 0)`;
      if (canvasRef.current) canvasRef.current.style.transform = offset;
      // The ruler takes the x and nothing else: it slides with the cards but
      // stays pinned to the top of the stage.
      if (rulerRef.current) rulerRef.current.style.transform = offset;
    }

    /**
     * Carries a flick on after the pointer has gone.
     *
     * The board is heavy: letting go mid-sweep and having it stop dead reads
     * as the gesture being dropped rather than finished.
     */
    function glide() {
      cancelAnimationFrame(frame.current);

      const step = () => {
        velocity.current *= DECAY;
        if (Math.abs(velocity.current) < MIN_VELOCITY) return;

        apply(pan.current + velocity.current);
        frame.current = requestAnimationFrame(step);
      };

      frame.current = requestAnimationFrame(step);
    }

    /**
     * Scrolling over the board moves through time rather than down the page.
     *
     * Whichever axis the gesture is mostly on wins: a mouse wheel only has a
     * y, and a trackpad swipe is mostly x, and both should travel the same
     * way. Registered natively and not through React because preventDefault
     * needs a listener that is not passive, and React's onWheel is.
     */
    function onWheel(event: WheelEvent) {
      event.preventDefault();

      cancelAnimationFrame(frame.current);
      velocity.current = 0;

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      apply(pan.current - delta);
    }

    function onPointerDown(event: PointerEvent) {
      // Controls sitting on the board are still controls.
      if ((event.target as HTMLElement).closest('button, input, select, a, textarea')) return;

      // Catching a board that is still travelling stops it, the way catching
      // a spinning thing does.
      cancelAnimationFrame(frame.current);
      velocity.current = 0;

      drag.current = { x: event.clientX, from: pan.current };
      moved.current = false;
      stage!.style.cursor = 'grabbing';
    }

    function onPointerMove(event: PointerEvent) {
      if (!drag.current) return;

      const dx = event.clientX - drag.current.x;
      if (Math.abs(dx) > DRAG_SLOP) moved.current = true;

      const next = drag.current.from + dx;
      // How far this move asked to travel, which is what carries on afterwards.
      velocity.current = next - pan.current;
      apply(next);
    }

    function onPointerUp() {
      if (!drag.current) return;

      const wasDrag = moved.current;
      drag.current = null;
      stage!.style.cursor = 'grab';

      // A press that never moved is a press, and a card underneath it is
      // about to be opened. Nothing should slide out from under it.
      if (wasDrag) glide();
    }

    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      cancelAnimationFrame(frame.current);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [stageRef, canvasRef, rulerRef]);

  return moved;
}
