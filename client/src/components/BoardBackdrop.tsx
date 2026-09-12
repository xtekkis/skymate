import type { CSSProperties } from 'react';

import { useBackdropParallax } from './useBackdropParallax';
import { useReducedMotion } from './useReducedMotion';

import './BoardBackdrop.css';

interface Route {
  id: string;
  d: string;
  width: number;
  alpha: number;
  dash: string;
  /** Seconds for the dashes to travel the whole route once. */
  drift: number;
  /** Against the arrows, so the five do not read as one conveyor belt. */
  reverse?: boolean;
  light: {
    /** Seconds for one lap. Slower than the dashes, so it overtakes nothing. */
    dur: number;
    /** Negative, so each light starts mid-route rather than all at the left. */
    begin: number;
    glow: number;
    dot: number;
    opacity: number;
  };
}

/** The routes the arcs follow, in the SVG's own 1600x900 space. */
const ROUTES: Route[] = [
  {
    id: 'skymate-route-1',
    d: 'M-140 730 C 340 540, 720 440, 1180 200 S 1560 90, 1780 56',
    width: 1.4,
    alpha: 0.52,
    dash: '7 11',
    drift: 34,
    light: { dur: 46, begin: -6, glow: 11, dot: 2.1, opacity: 0.85 },
  },
  {
    id: 'skymate-route-2',
    d: 'M-160 880 C 420 790, 900 710, 1780 404',
    width: 1.25,
    alpha: 0.38,
    dash: '6 12',
    drift: 58,
    light: { dur: 64, begin: -22, glow: 10, dot: 1.9, opacity: 0.7 },
  },
  {
    id: 'skymate-route-3',
    d: 'M1780 210 C 1280 300, 900 250, 520 96 S 180 30, -120 74',
    width: 1.25,
    alpha: 0.42,
    dash: '5 13',
    drift: 52,
    reverse: true,
    light: { dur: 72, begin: -30, glow: 10, dot: 1.9, opacity: 0.72 },
  },
  {
    id: 'skymate-route-4',
    d: 'M-120 400 C 300 470, 560 590, 900 560 S 1400 470, 1780 520',
    width: 1.15,
    alpha: 0.34,
    dash: '4 13',
    drift: 76,
    reverse: true,
    light: { dur: 120, begin: -14, glow: 9, dot: 1.7, opacity: 0.58 },
  },
  {
    id: 'skymate-route-5',
    d: 'M240 920 C 420 640, 760 500, 1080 476 S 1500 520, 1780 300',
    width: 1.15,
    alpha: 0.3,
    dash: '4 16',
    drift: 68,
    light: { dur: 94, begin: -52, glow: 9, dot: 1.7, opacity: 0.6 },
  },
];

/**
 * What the board sits in.
 *
 * Four layers of nothing in particular: a wash of colour, dashed arcs that
 * read as routes, a field of dots, and grain over the lot. None of it carries
 * information, which is why the whole thing is hidden from a screen reader and
 * takes no pointer events. It is the room the cards are lit in.
 */
export default function BoardBackdrop() {
  const reduced = useReducedMotion();
  const layers = useBackdropParallax(!reduced);

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__wash" ref={layers.wash} />

      <svg
        className="backdrop__arcs"
        ref={layers.arcs}
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          {ROUTES.map((route) => (
            <path key={route.id} id={route.id} d={route.d} fill="none" />
          ))}

          <radialGradient id="skymate-light">
            <stop offset="0%" stopColor="oklch(0.98 0.01 260 / 0.9)" />
            <stop offset="100%" stopColor="oklch(0.98 0.01 260 / 0)" />
          </radialGradient>
        </defs>

        {ROUTES.map((route) => (
          <use
            key={route.id}
            href={`#${route.id}`}
            className="backdrop__route"
            stroke={`oklch(0.82 0.03 258 / ${route.alpha})`}
            strokeWidth={route.width}
            strokeDasharray={route.dash}
            style={
              {
                animationDuration: `${route.drift}s`,
                animationDirection: route.reverse ? 'reverse' : 'normal',
              } as CSSProperties
            }
          />
        ))}

        {/*
         * The lights that travel the routes. Left off the page entirely when
         * less movement was asked for: this is SMIL, and the stylesheet rule
         * that flattens every animation in the app cannot reach it.
         */}
        {!reduced &&
          ROUTES.map((route) => (
            <g key={route.id}>
              <circle r={route.light.glow} fill="url(#skymate-light)" opacity={route.light.opacity} />
              <circle r={route.light.dot} fill="oklch(0.99 0.003 260)" />
              <animateMotion
                dur={`${route.light.dur}s`}
                begin={`${route.light.begin}s`}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href={`#${route.id}`} />
              </animateMotion>
            </g>
          ))}
      </svg>

      <div className="backdrop__dots" ref={layers.dots} />
      {/* No ref, and none wanted. Grain that drifts with the others stops
          reading as grain on the screen and starts reading as a fourth
          picture sliding about. */}
      <div className="backdrop__grain" />
    </div>
  );
}
