import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import './StoryBlocks.css';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Three things worth saying, and nothing more.
 *
 * Every line here is a claim about something this app actually does, checkable
 * against the code. Copy that could belong to any flight site would be worse
 * than no copy at all.
 */
const BLOCKS = [
  {
    title: 'Straight from the airport',
    body: 'Times, gates and terminals come from the airport’s own feed. A revised departure shows the old time struck through beside the new one, so you can see what changed.',
  },
  {
    title: 'It knows which airport you are looking at',
    body: 'Ask the assistant how early to arrive and it already knows where here is. It has no access to flight data and will not pretend otherwise.',
  },
  {
    title: 'Nothing to sign up for',
    body: 'No account, no tracking, no cookie banner. One saved setting, and that is whether you prefer it light or dark.',
  },
];

export default function StoryBlocks() {
  const rootRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add('(prefers-reduced-motion: no-preference)', () => {
        // One trigger per block rather than one for the section: they should
        // arrive as you reach them, not all at once when the section does.
        for (const block of gsap.utils.toArray<HTMLElement>('.story__block')) {
          gsap.from(block, {
            opacity: 0,
            y: 18,
            duration: 0.5,
            ease: 'power2.out',
            clearProps: 'opacity,transform',
            scrollTrigger: {
              trigger: block,
              // Well inside the viewport, so a block is never still animating
              // by the time it is somewhere you would be reading.
              start: 'top 88%',
              once: true,
            },
          });
        }

        // The page itself animates in with a transform, and a transformed
        // ancestor measures wrong. One remeasure once that has settled costs
        // nothing and stops a block triggering at the wrong scroll position.
        ScrollTrigger.refresh();
      });

      return () => media.revert();
    },
    { scope: rootRef },
  );

  return (
    <section className="story" ref={rootRef} aria-label="About Skymate">
      {BLOCKS.map((block) => (
        <article className="story__block" key={block.title}>
          <h2 className="story__title">{block.title}</h2>
          <p className="story__body">{block.body}</p>
        </article>
      ))}
    </section>
  );
}
