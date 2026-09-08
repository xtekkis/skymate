import { useCallback, useState } from 'react';

import type { Flight } from '../models';
import BoardStage from './BoardStage';
import FlightCard from './FlightCard';
import {
  CARD_W,
  assignLanes,
  contentHeight,
  laneCountFor,
  laneTop,
  minutesOfLocal,
  offsetFor,
} from './boardGeometry';

interface FlightBoardProps {
  /** In scheduled order, which is the order the server already returns. */
  flights: Flight[];
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
  start,
  windowHours,
  selectedId = null,
  onOpen,
}: FlightBoardProps) {
  const [stageHeight, setStageHeight] = useState(0);

  // Stable, or the stage would tear its resize listener down on every render.
  const onHeight = useCallback((height: number) => setStageHeight(height), []);

  const minutes = flights.map((flight) => minutesOfLocal(flight.scheduledLocal));
  const lanes = assignLanes(minutes, start, laneCountFor(stageHeight));

  // Taller than the stage only once the lanes have overflowed their target,
  // which is exactly when there is somewhere to travel down to.
  const used = lanes.length > 0 ? Math.max(...lanes) + 1 : 0;

  return (
    <BoardStage
      start={start}
      windowHours={windowHours}
      contentHeight={contentHeight(used)}
      onHeight={onHeight}
    >
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
