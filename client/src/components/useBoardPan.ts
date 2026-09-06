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

    function onPointerDown(event: PointerEvent) {
      // Controls sitting on the board are still controls.
      if ((event.target as HTMLElement).closest('button, input, select, a, textarea')) return;

      drag.current = { x: event.clientX, from: pan.current };
      moved.current = false;
      stage!.style.cursor = 'grabbing';
    }

    function onPointerMove(event: PointerEvent) {
      if (!drag.current) return;

      const dx = event.clientX - drag.current.x;
      if (Math.abs(dx) > DRAG_SLOP) moved.current = true;
      apply(drag.current.from + dx);
    }

    function onPointerUp() {
      if (!drag.current) return;
      drag.current = null;
      stage!.style.cursor = 'grab';
    }

    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [stageRef, canvasRef, rulerRef]);

  return moved;
}
