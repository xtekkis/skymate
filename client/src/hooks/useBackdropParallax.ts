import { useEffect, useRef } from 'react';

/**
 * How far each layer travels between one edge of the window and the other,
 * in pixels.
 *
 * The wash goes one way and the dots the other, by different amounts. That
 * opposition is the whole effect: layers that all slide together read as one
 * flat picture being nudged, rather than as three at different distances.
 *
 * Small numbers on purpose. The pointer runs from -0.5 to 0.5, so the largest
 * of these moves twenty three pixels end to end.
 */
export const DEPTH = {
  wash: { x: -26, y: -18 },
  arcs: { x: 16, y: 12 },
  dots: { x: 46, y: 30 },
} as const;

/**
 * The backdrop's layers drifting under the pointer.
 *
 * Written straight to the elements rather than held in state, the same way
 * the board's own pan is: this runs on every pointer move, and a re-render per
 * move would cost more than the effect is worth.
 *
 * A frame is scheduled only when the pointer has actually moved, so a still
 * mouse costs nothing. The design this comes from ran a loop forever.
 */
export function useBackdropParallax(enabled: boolean) {
  const wash = useRef<HTMLDivElement>(null);
  const arcs = useRef<SVGSVGElement>(null);
  const dots = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layers = [
      [wash, DEPTH.wash],
      [arcs, DEPTH.arcs],
      [dots, DEPTH.dots],
    ] as const;

    // Nothing attached at all, rather than a listener that does nothing.
    //
    // Nothing to undo here either: turning the preference on re-runs this
    // effect, and React runs the previous cleanup first, which is what puts
    // the layers back where the stylesheet had them.
    if (!enabled) return;

    let frame = 0;
    const pointer = { x: 0, y: 0 };

    const write = () => {
      frame = 0;
      for (const [layer, depth] of layers) {
        const element = layer.current;
        if (!element) continue;
        element.style.transform = `translate3d(${pointer.x * depth.x}px, ${pointer.y * depth.y}px, 0)`;
      }
    };

    const onMove = (event: PointerEvent) => {
      // Max(1) because a zero-width window would otherwise put every layer at
      // infinity, which is a real value a headless browser reports.
      pointer.x = event.clientX / Math.max(1, window.innerWidth) - 0.5;
      pointer.y = event.clientY / Math.max(1, window.innerHeight) - 0.5;

      // Several moves can land between two frames. Only the last one matters.
      if (!frame) frame = requestAnimationFrame(write);
    };

    window.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
      for (const [layer] of layers) layer.current?.style.removeProperty('transform');
    };
  }, [enabled]);

  return { wash, arcs, dots };
}
