import { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

/**
 * Gives the page weight.
 *
 * Scroll normally jumps to wherever the wheel says. Lenis interpolates toward
 * it instead, so a flick eases to a stop, which is most of why the sites this
 * hero is modelled on feel expensive rather than merely animated.
 *
 * It intercepts scrolling for the whole document, which is why the two places
 * that scroll on their own are marked data-lenis-prevent: the flight board,
 * which scrolls sideways, and the assistant's conversation, which scrolls
 * itself to the newest message. Without that, dragging inside either one moves
 * the page underneath instead.
 */
export default function SmoothScroll() {
  useEffect(() => {
    // Interpolated scrolling is motion, and someone who turned motion off did
    // not ask for their scrollbar to be reinterpreted.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      // Low enough to feel deliberate, high enough not to feel like lag.
      lerp: 0.1,
      wheelMultiplier: 1,
      // Touch devices already have momentum from the operating system, and
      // layering ours on top of it feels broken rather than smooth.
      syncTouch: false,
    });

    /*
     * One clock for both libraries.
     *
     * ScrollTrigger reads scroll position and Lenis writes it. Left on
     * separate loops they disagree by a frame, and every scrubbed animation
     * lags a step behind the page it belongs to.
     */
    const raf = (time: number) => lenis.raf(time * 1000);

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}
