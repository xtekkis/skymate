import { useCallback, useEffect, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import type { Flight } from '../models';
import BoardStage from './BoardStage';
import FlightCard from './FlightCard';
import {
  CARD_W,
  assignLanes,
  contentHeight,
  laneCountFor,
  laneTop,
  hhmm,
  minutesAfter,
  offsetFor,
  nowOffset,
} from './boardGeometry';
import './FlightBoard.css';

gsap.registerPlugin(useGSAP);

/** Long enough to read as arriving, short enough not to be waited on. */
const ARRIVE_S = 0.32;

/** Between one card and the next, up to the cap below. */
const STEP_S = 0.022;

/**
 * Where the stagger stops accumulating.
 *
 * A busy board is forty cards. Left to add up, the last of them would begin
 * arriving almost a second after the first, and the board would feel slow to
 * load rather than pleased to see you.
 */
const STAGGER_CAP_S = 0.32;

/**
 * How often the now line catches up with the clock.
 *
 * At the board scale thirty seconds is under two pixels, so it creeps
 * rather than jumps, and a board left open does not quietly start lying
 * about where the present is.
 */
const NOW_TICK_MS = 30_000;

interface FlightBoardProps {
  /** In scheduled order, which is the order the server already returns. */
  flights: Flight[];
  /** The board's date, YYYY-MM-DD. Decides whether there is a now to draw. */
  date: string;
  /** Window start, in minutes since local midnight. */
  start: number;
  windowHours: number;
  selectedId?: string | null;
  onOpen: (flight: Flight) => void;
}

/**
 * The flights, placed on the time axis.
 *
 * Where each card goes is two decisions: how far along, which is the minute it
 * leaves, and how far down, which is the lane it was dealt. Both are worked
 * out in boardGeometry, so this is only the placing.
 */
export default function FlightBoard({
  flights,
  date,
  start,
  windowHours,
  selectedId = null,
  onOpen,
}: FlightBoardProps) {
  const [stageHeight, setStageHeight] = useState(0);
  const [minute, setMinute] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setMinute(Date.now()), NOW_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  /**
   * Cards arrive rather than appear, the way a board fills in.
   *
   * from() rather than fromTo(): the start state is the one GSAP invents, so
   * a board whose animation never runs is a board that is simply visible.
   * clearProps takes back only opacity and transform, leaving the left and
   * top this component put there.
   */
  useGSAP(
    () => {
      const media = gsap.matchMedia();

      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.stage__canvas .card', {
          opacity: 0,
          y: 10,
          duration: ARRIVE_S,
          ease: 'power2.out',
          stagger: (index: number) => Math.min(STAGGER_CAP_S, index * STEP_S),
          clearProps: 'opacity,transform',
        });
      });

      return () => media.revert();
    },
    { dependencies: [flights], revertOnUpdate: true },
  );

  // Stable, or the stage would tear its resize listener down on every render.
  const onHeight = useCallback((height: number) => setStageHeight(height), []);

  // Where each card sits, as minutes of the window's opening day: a flight
  // at 02:00 the next morning is 1,560, not 120, so it lands after 23:00
  // rather than a day before the board begins.
  const opens = `${date}T${hhmm(start)}`;
  const minutes = flights.map((flight) => start + minutesAfter(flight.scheduledLocal, opens));
  const lanes = assignLanes(minutes, start, laneCountFor(stageHeight));

  // Taller than the stage only once the lanes have overflowed their target,
  // which is exactly when there is somewhere to travel down to.
  const used = lanes.length > 0 ? Math.max(...lanes) + 1 : 0;
  const now = nowOffset({ start, windowHours, date, now: new Date(minute) });

  return (
    <BoardStage
      start={start}
      windowHours={windowHours}
      contentHeight={contentHeight(used)}
      onHeight={onHeight}
    >
      {now !== null && (
        <div className="now" style={{ left: now }}>
          <span className="now__label">Now</span>
        </div>
      )}

      {flights.map((flight, index) => (
        <FlightCard
          key={flight.id}
          flight={flight}
          selected={flight.id === selectedId}
          onOpen={onOpen}
          style={{
            position: 'absolute',
            left: offsetFor(minutes[index], start),
            top: laneTop(lanes[index]),
            width: CARD_W,
          }}
        />
      ))}
    </BoardStage>
  );
}
