import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './HeroScroll.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** A cartoon cumulus: overlapping ellipses that merge into one shape. */
function Puff({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="62" ry="34" />
      <ellipse cx="-40" cy="10" rx="34" ry="24" />
      <ellipse cx="42" cy="12" rx="30" ry="22" />
      <ellipse cx="10" cy="-20" rx="32" ry="26" />
      <ellipse cx="-14" cy="-8" rx="30" ry="26" />
    </g>
  );
}

/** One drifting band of cloud. Three of these, at three depths, make parallax. */
function CloudBand({ className, puffs }: { className: string; puffs: [number, number, number][] }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {puffs.map(([x, y, scale]) => (
        <Puff key={`${x}-${y}`} x={x} y={y} scale={scale} />
      ))}
    </svg>
  );
}

/**
 * The aircraft, seen from above.
 *
 * Flat shapes rather than a rendering: it holds together at any angle because
 * it is drawn, which is the whole reason this is not video.
 */
function Plane() {
  return (
    <svg className="hero__planeSvg" viewBox="0 0 200 210" aria-hidden="true">
      <path className="hero__wing" d="M100 88 L14 130 L14 143 L100 120 L186 143 L186 130 Z" />
      <path className="hero__wing" d="M100 152 L68 172 L68 180 L100 168 L132 180 L132 172 Z" />
      <path
        className="hero__fuselage"
        d="M100 14 C111 38 116 82 116 132 C116 170 109 190 100 198 C91 190 84 170 84 132 C84 82 89 38 100 14 Z"
      />
      <rect className="hero__engine" x="48" y="126" width="17" height="30" rx="8" />
      <rect className="hero__engine" x="135" y="126" width="17" height="30" rx="8" />
      <path
        className="hero__stripe"
        d="M100 22 C106 44 110 84 110 132 L90 132 C90 84 94 44 100 22 Z"
      />
    </svg>
  );
}

export default function HeroScroll() {
  const rootRef = useRef<HTMLElement>(null);

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
         * Three beats, scrubbed rather than played.
         *
         * fromTo throughout, never from: the CSS default is the readable
         * middle of the scene, so anything that stops this timeline running
         * leaves a hero that still looks like something.
         */

        // 1. Climbing out of the cloud, with the type rising through it.
        timeline
          .fromTo('.hero__band--near', { yPercent: 34, scale: 1.55 }, { yPercent: 106, scale: 1.1, ease: 'none' }, 0)
          .fromTo('.hero__band--mid', { yPercent: 4, scale: 1.25 }, { yPercent: 64, scale: 1, ease: 'none' }, 0)
          .fromTo('.hero__band--far', { yPercent: -16, scale: 1.06 }, { yPercent: 22, scale: 1, ease: 'none' }, 0)
          .fromTo('.hero__title', { opacity: 0, yPercent: 26, scale: 1.14 }, { opacity: 1, yPercent: 0, scale: 1, ease: 'power2.out', duration: 0.34 }, 0)

          // 2. The aircraft crosses in front of the words.
          .fromTo(
            '.hero__plane',
            { opacity: 0, scale: 0.4, yPercent: 46, xPercent: -34, rotate: -30 },
            { opacity: 1, scale: 1, yPercent: 0, xPercent: 0, rotate: 0, ease: 'power1.out', duration: 0.46 },
            0.2,
          )
          .to('.hero__title', { yPercent: -14, opacity: 0.16, ease: 'none', duration: 0.34 }, 0.46)

          // 3. It runs, and the sky hands over to the page.
          .to('.hero__plane', { scale: 1.7, rotate: 14, xPercent: 34, yPercent: -18, ease: 'power2.in', duration: 0.28 }, 0.72)
          .fromTo('.hero__streaks', { opacity: 0, scaleX: 0.4 }, { opacity: 0.75, scaleX: 1, ease: 'power2.in', duration: 0.2 }, 0.74)
          .fromTo('.hero__wash', { opacity: 0 }, { opacity: 1, ease: 'power2.in', duration: 0.22 }, 0.78);

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

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    main.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <section className="hero" ref={rootRef} aria-label="Introduction">
      <div className="hero__stage">
        <div className="hero__sky" aria-hidden="true" />

        <CloudBand
          className="hero__band hero__band--far"
          puffs={[
            [140, 150, 0.7],
            [520, 120, 0.55],
            [900, 165, 0.65],
            [1290, 130, 0.5],
          ]}
        />

        {/*
          The type sits between the far cloud and the aircraft. Being crossed
          by something is what makes a flat scene read as deep, and it is the
          one thing a centred title over a picture never does.
        */}
        <div className="hero__copy">
          <h1 className="hero__title">
            <span>Every departure board</span>
            <span>in the world</span>
          </h1>
        </div>

        <CloudBand
          className="hero__band hero__band--mid"
          puffs={[
            [80, 190, 1],
            [560, 210, 0.85],
            [1010, 180, 1.05],
            [1400, 205, 0.9],
          ]}
        />

        <div className="hero__plane">
          <Plane />
          <div className="hero__streaks" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <CloudBand
          className="hero__band hero__band--near"
          puffs={[
            [-40, 250, 1.5],
            [420, 275, 1.35],
            [960, 255, 1.5],
            [1420, 270, 1.4],
          ]}
        />

        <div className="hero__grain" aria-hidden="true" />

        <div className="hero__rail">
          <span className="hero__label">01 / Intro</span>
          <span className="hero__label hero__label--wide">Live schedules, 4,132 airports</span>
          <button type="button" className="hero__skip" onClick={skip}>
            Skip intro
          </button>
        </div>

        {/* Fades up at the end so the illustration hands over to the page
            rather than being cut off by it. */}
        <div className="hero__wash" aria-hidden="true" />
      </div>
    </section>
  );
}
