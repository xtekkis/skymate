import './BoardBackdrop.css';

/** The routes the dashed arcs follow, in the SVG's own 1600x900 space. */
const ROUTES = [
  { d: 'M-140 730 C 340 540, 720 440, 1180 200 S 1560 90, 1780 56', width: 1.4, alpha: 0.52, dash: '7 11' },
  { d: 'M-160 880 C 420 790, 900 710, 1780 404', width: 1.25, alpha: 0.38, dash: '6 12' },
  { d: 'M1780 210 C 1280 300, 900 250, 520 96 S 180 30, -120 74', width: 1.25, alpha: 0.42, dash: '5 13' },
  { d: 'M-120 400 C 300 470, 560 590, 900 560 S 1400 470, 1780 520', width: 1.15, alpha: 0.34, dash: '4 13' },
  { d: 'M240 920 C 420 640, 760 500, 1080 476 S 1500 520, 1780 300', width: 1.15, alpha: 0.3, dash: '4 16' },
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
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__wash" />

      <svg
        className="backdrop__arcs"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        {ROUTES.map((route) => (
          <path
            key={route.d}
            d={route.d}
            fill="none"
            stroke={`oklch(0.82 0.03 258 / ${route.alpha})`}
            strokeWidth={route.width}
            strokeDasharray={route.dash}
          />
        ))}
      </svg>

      <div className="backdrop__dots" />
      <div className="backdrop__grain" />
    </div>
  );
}
