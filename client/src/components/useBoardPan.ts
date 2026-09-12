import { useEffect, useRef, type RefObject } from 'react';

import { LANE_H, PX_PER_MINUTE, RULER_H, clampPan } from './boardGeometry';

interface BoardPanOptions {
  stageRef: RefObject<HTMLElement | null>;
  canvasRef: RefObject<HTMLElement | null>;
  rulerRef: RefObject<HTMLElement | null>;
  /** How wide the canvas is, which is how far there is to travel sideways. */
  contentWidth: number;
  /** And how tall, which is only more than the stage once lanes overflow. */
  contentHeight: number;
}

/** Past this, a pointer was dragging the board rather than clicking a card. */
export const DRAG_SLOP = 4;

/** What a flick keeps, frame to frame, once the pointer has gone. */
export const DECAY = 0.92;

/** Below a quarter of a pixel a frame there is nothing left to see. */
export const MIN_VELOCITY = 0.25;

/**
 * How far one press of an arrow key travels.
 *
 * Half an hour sideways, because the ruler is marked in half hours and a step
 * that lands between two marks is a step you cannot count. One lane
 * vertically, for the same reason: the rows are the unit.
 */
export const STEP_MINUTES = 30;

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
export function useBoardPan({
  stageRef,
  canvasRef,
  rulerRef,
  contentWidth,
  contentHeight,
}: BoardPanOptions) {
  const pan = useRef({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; fromX: number; fromY: number } | null>(null);
  const moved = useRef(false);
  const velocity = useRef({ x: 0, y: 0 });
  const frame = useRef(0);

  // Read inside the listeners rather than captured, so a window change does
  // not need the listeners torn down and rebuilt.
  const size = useRef({ width: contentWidth, height: contentHeight });
  size.current = { width: contentWidth, height: contentHeight };

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function apply(nextX: number, nextY: number) {
      const stageEl = stageRef.current;
      const viewW = stageEl?.clientWidth ?? 0;
      // The ruler owns the top of the stage, so the cards travel in what is
      // left below it.
      // Never negative: a stage shorter than its own ruler would otherwise
      // report room to travel that does not exist.
      const viewH = Math.max(0, (stageEl?.clientHeight ?? 0) - RULER_H);

      pan.current = {
        x: clampPan(nextX, viewW, size.current.width),
        y: clampPan(nextY, viewH, size.current.height),
      };

      if (canvasRef.current) {
        canvasRef.current.style.transform = `translate3d(${pan.current.x}px, ${pan.current.y}px, 0)`;
      }

      // The ruler takes the x and nothing else. It slides with the cards and
      // stays pinned to the top, so the clock stays readable whatever row is
      // being pushed around underneath it.
      if (rulerRef.current) {
        rulerRef.current.style.transform = `translate3d(${pan.current.x}px, 0, 0)`;
      }
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
        velocity.current = { x: velocity.current.x * DECAY, y: velocity.current.y * DECAY };

        const spent =
          Math.abs(velocity.current.x) < MIN_VELOCITY &&
          Math.abs(velocity.current.y) < MIN_VELOCITY;
        if (spent) return;

        apply(pan.current.x + velocity.current.x, pan.current.y + velocity.current.y);
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
      velocity.current = { x: 0, y: 0 };

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      apply(pan.current.x - delta, pan.current.y);
    }

    /**
     * Panning from the keyboard.
     *
     * Only when the stage itself has focus. A card inside it is a button, and
     * arrows pressed while one is focused belong to whatever the reader is
     * doing there rather than to the board underneath.
     *
     * Home and End go to the ends of the window, which is the one thing that
     * would otherwise take forty presses.
     */
    function onKeyDown(event: KeyboardEvent) {
      if (event.target !== stage) return;

      const stageEl = stageRef.current;
      const viewW = stageEl?.clientWidth ?? 0;
      const step = STEP_MINUTES * PX_PER_MINUTE;

      let { x, y } = pan.current;

      switch (event.key) {
        case 'ArrowLeft':
          x += step;
          break;
        case 'ArrowRight':
          x -= step;
          break;
        case 'ArrowUp':
          y += LANE_H;
          break;
        case 'ArrowDown':
          y -= LANE_H;
          break;
        case 'Home':
          x = 0;
          break;
        case 'End':
          // Clamped anyway, so anything past the end lands on the end.
          x = -size.current.width;
          break;
        case 'PageUp':
          x += viewW;
          break;
        case 'PageDown':
          x -= viewW;
          break;
        default:
          return;
      }

      // Only now that a key we handle has been recognised, or this eats every
      // other key the page might want, Tab included.
      event.preventDefault();

      cancelAnimationFrame(frame.current);
      velocity.current = { x: 0, y: 0 };
      apply(x, y);
    }

    /**
     * Eats the click a drag is about to produce.
     *
     * Capturing and one-shot, so it lands before the card underneath ever
     * hears about it. Removed again on the next press, in case the release
     * happened somewhere that produced no click at all and it is still there.
     */
    function swallow(event: MouseEvent) {
      event.stopPropagation();
      event.preventDefault();
    }

    function onPointerDown(event: PointerEvent) {
      /*
       * Cards are buttons and they cover most of the board, so a button has to
       * be draggable through or there is nowhere left to grab. What is opted
       * out is named explicitly, plus the controls that own a drag of their
       * own: a slider, a select, text being selected in a field.
       */
      if ((event.target as HTMLElement).closest('[data-no-pan], input, select, textarea')) return;

      stage!.removeEventListener('click', swallow, { capture: true });

      // Catching a board that is still travelling stops it, the way catching
      // a spinning thing does.
      cancelAnimationFrame(frame.current);
      velocity.current = { x: 0, y: 0 };

      drag.current = {
        x: event.clientX,
        y: event.clientY,
        fromX: pan.current.x,
        fromY: pan.current.y,
      };
      moved.current = false;
      stage!.style.cursor = 'grabbing';
    }

    function onPointerMove(event: PointerEvent) {
      if (!drag.current) return;

      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > DRAG_SLOP) moved.current = true;

      const nextX = drag.current.fromX + dx;
      const nextY = drag.current.fromY + dy;

      // How far this move asked to travel, which is what carries on afterwards.
      velocity.current = { x: nextX - pan.current.x, y: nextY - pan.current.y };
      apply(nextX, nextY);
    }

    function onPointerUp() {
      if (!drag.current) return;

      const wasDrag = moved.current;
      drag.current = null;
      stage!.style.cursor = 'grab';

      // A press that never moved is a press, and a card underneath it is
      // about to be opened. Nothing should slide out from under it.
      if (!wasDrag) return;

      stage!.addEventListener('click', swallow, { capture: true, once: true });
      glide();
    }

    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('keydown', onKeyDown);
    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      cancelAnimationFrame(frame.current);
      stage.removeEventListener('click', swallow, { capture: true });
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('keydown', onKeyDown);
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [stageRef, canvasRef, rulerRef]);

  return moved;
}
