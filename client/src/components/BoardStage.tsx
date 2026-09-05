import { type ReactNode } from 'react';

import { contentWidth, toTicks } from './boardGeometry';
import './BoardStage.css';

interface BoardStageProps {
  /** Window start, in minutes since local midnight. */
  start: number;
  windowHours: number;
  /** The cards. Absolutely positioned against the canvas by the caller. */
  children?: ReactNode;
}

/**
 * The time axis the board is drawn on.
 *
 * Two layers that move together: a ruler pinned to the top, and a canvas
 * beneath it holding the cards. They are separate because the ruler travels
 * sideways with the canvas but never up and down with it, which is what keeps
 * the clock readable while you are pushing rows around underneath.
 */
export default function BoardStage({ start, windowHours, children }: BoardStageProps) {
  const ticks = toTicks(start, windowHours);

  return (
    <section className="stage" aria-label="Flight timeline">
      <div className="stage__ruler">
        <div className="stage__rulerInner" style={{ width: contentWidth(windowHours) }}>
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

      <div className="stage__canvas" style={{ width: contentWidth(windowHours) }}>
        {children}
      </div>
    </section>
  );
}
