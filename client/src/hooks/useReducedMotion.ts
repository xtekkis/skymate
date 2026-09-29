import { useMediaQuery } from './useMediaQuery';

/**
 * Whether this reader has asked for less movement.
 *
 * Most of the app never needs to ask: a blanket rule in the stylesheet already
 * flattens every CSS animation and transition. This is for the motion CSS
 * cannot reach, which in practice means SMIL, where the only way to not play
 * something is to not put it on the page.
 */
export function useReducedMotion() {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
