import { useEffect, useState } from 'react';

/**
 * Whether a media query currently matches, kept up to date.
 *
 * For the questions CSS cannot answer on its own: what to render, rather than
 * how to paint it. A breakpoint that only changes styling belongs in a
 * stylesheet, and asking here instead means the answer arrives a render late
 * and costs a render to change.
 *
 * Answers false where there is no matchMedia rather than throwing. An
 * environment that was never told about media queries is not a reader with a
 * preference, and it is also every server render.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);

  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;

    // Read again on mount: the answer can have changed between the first
    // render and this effect, and it decides what is on screen.
    setMatches(media.matches);

    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
