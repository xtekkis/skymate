import { useEffect, useRef, type ReactNode } from 'react';

import { contentWidth, toTicks } from './boardGeometry';
import { useBoardPan } from './useBoardPan';
import './BoardStage.css';

interface BoardStageProps {
  /** Window start, in minutes since local midnight. */
  start: number;
  windowHours: number;
  /** How far the cards reach down. Unset, there is nowhere to travel to. */
  contentHeight?: number;
  /** The cards. Absolutely positioned against the canvas by the caller. */
  children?: ReactNode;
  /**
   * How tall the stage is, whenever that changes.
   *
   * The board needs it to work out how many lanes fit, and only the stage
   * knows. Reported on a resize listener rather than watched with an observer,
   * because the pan geometry has to be recomputed on resize anyway and one
   * source of truth is simpler than two.
   */
  onHeight?: (height: number) => void;
}

/**
 * The time axis the board is drawn on.
 *
 * Two layers that move together: a ruler pinned to the top, and a canvas
 * beneath it holding the cards. They are separate because the ruler travels
 * sideways with the canvas but never up and down with it, which is what keeps
 * the clock readable while you are pushing rows around underneath.
 */
export default function BoardStage({
  start,
  windowHours,
  contentHeight = 0,
  children,
  onHeight,
}: BoardStageProps) {
  const ticks = toTicks(start, windowHours);
  const width = contentWidth(windowHours);

  const stageRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);

  useBoardPan({ stageRef, canvasRef, rulerRef, contentWidth: width, contentHeight });

  useEffect(() => {
    if (!onHeight) return;

    const report = () => onHeight(stageRef.current?.clientHeight ?? 0);

    report();
    window.addEventListener('resize', report);
    return () => window.removeEventListener('resize', report);
  }, [onHeight]);

  return (
    <section className="stage" ref={stageRef} aria-label="Flight timeline">
      <div className="stage__ruler">
        <div className="stage__rulerInner" ref={rulerRef} style={{ width }}>
          {ticks.map((tick) => (
            <div
              key={tick.at}
              className={tick.onTheHour ? 'stage__tick stage__tick--hour' : 'stage__tick'}
              style={{ left: tick.left }}
            >
              {tick.label && <span className="stage__tickLabel tabular">{tick.label}</span>}
            </div>
          ))}
        </div>
      </div>

      <div
        className="stage__canvas"
        ref={canvasRef}
        style={{ width, height: contentHeight || undefined }}
      >
        {children}
      </div>
    </section>
  );
}
