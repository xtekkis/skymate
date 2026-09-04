import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './HeroScroll.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const VIDEO = '/hero.mp4';
const POSTER = '/hero-poster.jpg';

export default function HeroScroll() {
  const rootRef = useRef<HTMLElement>(null);

  /*
   * Read once, at mount, rather than watched.
   *
   * This decides whether a megabyte of video is fetched at all, so it has to
   * be known before the first render. Someone who turns the preference on
   * mid-session gets it on their next load, which is the right trade against
   * tearing the hero down underneath them.
   */
  const [reduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add('(prefers-reduced-motion: no-preference)', () => {
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top top',
            end: 'bottom bottom',
            // A little smoothing, so a trackpad flick eases rather than snaps.
            scrub: 0.6,
          },
        });

        /*
         * fromTo throughout, never from: the CSS default is the readable state
         * of the scene, so anything that stops this timeline running leaves a
         * hero that still looks like something.
         */
        timeline
          // The frame closes in slowly. Small on purpose: a hard zoom on
          // footage this wide reads as a mistake rather than as a move.
          .fromTo('.hero__media', { scale: 1 }, { scale: 1.16, ease: 'none' }, 0)
          .fromTo('.hero__title', { opacity: 0, yPercent: 22 }, { opacity: 1, yPercent: 0, ease: 'power2.out', duration: 0.3 }, 0)
          .to('.hero__title', { yPercent: -26, opacity: 0, ease: 'power1.in', duration: 0.34 }, 0.52)
          // The scrim deepens as the type leaves, so the handover is a fade to
          // the page rather than a cut to it.
          .fromTo('.hero__scrim', { opacity: 1 }, { opacity: 0.55, ease: 'none', duration: 0.5 }, 0.3)
          .fromTo('.hero__wash', { opacity: 0 }, { opacity: 1, ease: 'power2.in', duration: 0.24 }, 0.78);

        // The page below animates itself in with a transform, and a transformed
        // ancestor measures wrong. One remeasure once that has settled.
        ScrollTrigger.refresh();
      });

      return () => media.revert();
    },
    { scope: rootRef },
  );

  function skip() {
    const main = document.getElementById('main');
    if (!main) return;

    main.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <section className="hero" ref={rootRef} aria-label="Introduction">
      <div className="hero__stage">
        {reduced ? (
          /*
           * The still, and no video request at all. A loop that plays forever
           * is motion, and the honest response to the preference is not to
           * download it rather than to download it and hold it still.
           */
          <img className="hero__media" src={POSTER} alt="" aria-hidden="true" />
        ) : (
          <video
            className="hero__media"
            src={VIDEO}
            poster={POSTER}
            aria-hidden="true"
            autoPlay
            // Autoplay is only permitted for muted video, so this is load
            // bearing rather than a preference.
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
          />
        )}

        {/*
          Not a flat dim. Heavier at the top where the words are and at the
          bottom where the rail is, and lightest across the middle, which is
          the only part of the frame the aircraft occupies.
        */}
        <div className="hero__scrim" aria-hidden="true" />
        <div className="hero__grain" aria-hidden="true" />

        <div className="hero__copy">
          <h1 className="hero__title">
            <span>Every departure board</span>
            <span>in the world</span>
          </h1>
        </div>

        <div className="hero__rail">
          <span className="hero__label">01 / Intro</span>
          <span className="hero__label hero__label--wide">Live schedules, 4,132 airports</span>
          <button type="button" className="hero__skip" onClick={skip}>
            Skip intro
          </button>
        </div>

        <div className="hero__wash" aria-hidden="true" />
      </div>
    </section>
  );
}
