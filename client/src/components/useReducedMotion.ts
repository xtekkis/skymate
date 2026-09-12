import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether this reader has asked for less movement.
 *
 * Most of the app never needs to ask: a blanket rule in the stylesheet already
 * flattens every CSS animation and transition. This is for the motion CSS
 * cannot reach, which in practice means SMIL, where the only way to not play
 * something is to not put it on the page.
 *
 * Answers false where there is no matchMedia at all rather than throwing,
 * because a test environment that has not been told about media queries is not
 * a reader asking for anything.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.(QUERY).matches ?? false);

  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return;

    // Read again on mount: the setting can have changed between the first
    // render and this effect, and the answer decides what is on screen.
    setReduced(media.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
