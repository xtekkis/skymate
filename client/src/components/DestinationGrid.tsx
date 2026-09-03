import { useMemo, useRef, type CSSProperties } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { AirplaneTakeoff, X } from '@phosphor-icons/react';

import type { Flight } from '../models';
import { hueFor, toDestinations } from './destinations';
import './DestinationGrid.css';

interface DestinationGridProps {
  flights: Flight[];
  /** The code currently filtering the board, or null for all of them. */
  selected: string | null;
  onSelect: (iata: string | null) => void;
}

export default function DestinationGrid({ flights, selected, onSelect }: DestinationGridProps) {
  const destinations = useMemo(() => toDestinations(flights), [flights]);
  const gridRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add('(prefers-reduced-motion: no-preference)', () => {
        // Same shape as the board's entrance, so the page reads as one thing
        // filling in rather than two components each doing their own trick.
        gsap.from('.dest', {
          opacity: 0,
          y: 10,
          duration: 0.34,
          ease: 'power2.out',
          stagger: 0.04,
          clearProps: 'opacity,transform',
        });
      });

      return () => media.revert();
    },
    { scope: gridRef, dependencies: [destinations], revertOnUpdate: true },
  );

  if (destinations.length === 0) return null;

  return (
    <section className="dests" ref={gridRef} aria-labelledby="dests-title">
      <div className="dests__head">
        <h2 className="dests__title" id="dests-title">
          Where today goes
        </h2>

        {selected && (
          <button type="button" className="dests__clear" onClick={() => onSelect(null)}>
            <X size={13} weight="bold" aria-hidden="true" />
            Show all destinations
          </button>
        )}
      </div>

      <ul className="dests__grid">
        {destinations.map((destination) => {
          const active = destination.iata === selected;

          return (
            <li key={destination.iata}>
              <button
                type="button"
                className={active ? 'dest dest--active' : 'dest'}
                style={{ '--dest-hue': hueFor(destination.iata) } as CSSProperties}
                aria-pressed={active}
                onClick={() => onSelect(active ? null : destination.iata)}
              >
                <AirplaneTakeoff
                  className="dest__glyph"
                  size={44}
                  weight="light"
                  aria-hidden="true"
                />

                <span className="dest__code tabular">{destination.iata}</span>
                <span className="dest__name">{destination.name}</span>
                <span className="dest__meta">
                  {destination.count === 1 ? '1 flight' : `${destination.count} flights`}
                  {', first at '}
                  <span className="tabular">{destination.earliest}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
