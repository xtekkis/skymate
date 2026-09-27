import { useCallback, useEffect, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import type { Flight } from '../models';
import type { Arrival } from './flightArrival';
import BoardStage from './BoardStage';
import FlightCard from './FlightCard';
import {
  CARD_W,
  assignLanes,
  contentHeight,
  laneCountFor,
  laneTop,
  PX_PER_MINUTE,
  axisFor,
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
  /** What has been checked so far, by flight id. Empty until someone asks. */
  arrivals?: Record<string, Arrival>;
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
  arrivals = {},
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

  /*
   * Where each card sits, as minutes from when the window opened. Counted by
   * date as well as clock, so a flight at 02:00 the next morning is 360 into
   * a window that opened at 20:00 rather than a day before it began.
   *
   * Negative for a flight scheduled before the window, which happens whenever
   * its revised time is the one inside. The axis grows to the left to hold
   * those rather than the stage clipping them.
   */
  const opens = `${date}T${hhmm(start)}`;
  const offsets = flights.map((flight) => minutesAfter(flight.scheduledLocal, opens));

  const axis = axisFor(offsets, windowHours);
  const axisStart = start - axis.lead;

  const minutes = offsets.map((offset) => start + offset);
  const lanes = assignLanes(minutes, axisStart, laneCountFor(stageHeight));

  // Taller than the stage only once the lanes have overflowed their target,
  // which is exactly when there is somewhere to travel down to.
  const used = lanes.length > 0 ? Math.max(...lanes) + 1 : 0;
  /*
   * Measured against the window rather than the whole axis, then moved along
   * by whatever room the axis grew in front of it. Now is only ever on the
   * board while the window it belongs to is open.
   */
  const present = nowOffset({ start, windowHours, date, now: new Date(minute) });
  const now = present === null ? null : present + axis.lead * PX_PER_MINUTE;

  return (
    <BoardStage
      start={axisStart}
      windowHours={axis.hours}
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
          arrival={arrivals[flight.id]}
          style={{
            position: 'absolute',
            left: offsetFor(minutes[index], axisStart),
            top: laneTop(lanes[index]),
            width: CARD_W,
          }}
        />
      ))}
    </BoardStage>
  );
}
