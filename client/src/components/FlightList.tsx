import type { Flight, FlightDirection, FlightStatus } from '../models';
import './FlightList.css';

interface FlightListProps {
  flights: Flight[];
  direction: FlightDirection;
}

const STATUS_LABEL: Record<FlightStatus, string> = {
  Unknown: 'Unknown',
  Expected: 'Expected',
  CheckIn: 'Check in',
  Boarding: 'Boarding',
  GateClosed: 'Gate closed',
  Departed: 'Departed',
  EnRoute: 'En route',
  Approaching: 'Approaching',
  Arrived: 'Arrived',
  Delayed: 'Delayed',
  Diverted: 'Diverted',
  Canceled: 'Cancelled',
};

const STATUS_TONE: Record<FlightStatus, string> = {
  Unknown: 'muted',
  Expected: 'info',
  CheckIn: 'info',
  Boarding: 'ok',
  GateClosed: 'warn',
  Departed: 'muted',
  EnRoute: 'muted',
  Approaching: 'ok',
  Arrived: 'ok',
  Delayed: 'warn',
  Diverted: 'warn',
  Canceled: 'danger',
};

/**
 * Reads the wall-clock portion straight off the airport-local string. Parsing
 * it into a Date would re-render in the browser's timezone, which is the bug
 * scheduledLocal exists to avoid.
 */
function localTime(iso?: string) {
  return iso ? iso.slice(11, 16) : '--:--';
}

function isRevised(flight: Flight) {
  return Boolean(flight.revisedLocal) && flight.revisedLocal !== flight.scheduledLocal;
}

export default function FlightList({ flights, direction }: FlightListProps) {
  return (
    <div className="board">
      <table className="board__table">
        <caption className="visually-hidden">
          {direction === 'departure' ? 'Departures' : 'Arrivals'}, {flights.length} flights, ordered
          by scheduled time
        </caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Flight</th>
            <th scope="col" className="board__cell--wide">
              Airline
            </th>
            <th scope="col">{direction === 'departure' ? 'To' : 'From'}</th>
            <th scope="col">Status</th>
            <th scope="col" className="board__cell--wide">
              Terminal
            </th>
          </tr>
        </thead>
        <tbody>
          {flights.map((flight) => (
            <tr key={flight.id}>
              <td className="board__time tabular">
                {isRevised(flight) ? (
                  <>
                    <span className="board__time--was">{localTime(flight.scheduledLocal)}</span>
                    <span className="board__time--now">{localTime(flight.revisedLocal)}</span>
                  </>
                ) : (
                  localTime(flight.scheduledLocal)
                )}
              </td>

              <td className="tabular">{flight.number}</td>

              <td className="board__cell--wide">{flight.airline}</td>

              <td>
                <span className="board__iata tabular">{flight.counterpart.iata}</span>
                <span className="board__place">{flight.counterpart.name}</span>
              </td>

              <td>
                <span className={`badge badge--${STATUS_TONE[flight.status]}`}>
                  {STATUS_LABEL[flight.status]}
                </span>
              </td>

              <td className="board__cell--wide board__muted">
                {flight.terminal ? `T${flight.terminal}` : ''}
                {flight.terminal && flight.checkInDesk ? ' · ' : ''}
                {flight.checkInDesk ? `Desk ${flight.checkInDesk}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
