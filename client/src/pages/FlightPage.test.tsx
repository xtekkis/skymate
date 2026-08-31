import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FlightPage from './FlightPage';
import type { TrackedFlight } from '../models';
import { getFlightByNumber } from '../services/api';

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  getFlightByNumber: vi.fn(),
}));

const lookup = vi.mocked(getFlightByNumber);

const leg = (number: string): TrackedFlight => ({
  id: `${number}-2026-09-01`,
  number,
  airline: 'British Airways',
  status: 'Expected',
  departure: {
    airport: { iata: 'LHR', name: 'London Heathrow', municipality: 'London' },
    scheduledLocal: '2026-09-01T09:00+01:00',
  },
  arrival: {
    airport: { iata: 'JFK', name: 'John F Kennedy', municipality: 'New York' },
    scheduledLocal: '2026-09-01T12:00-04:00',
  },
  isCargo: false,
});

const found = (number: string, flights: TrackedFlight[]) => ({
  number,
  count: flights.length,
  flights,
});

/** Navigates without leaving the route, so the page keeps its state. */
function GoTo({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      go
    </button>
  );
}

function show(number: string, nextNumber?: string) {
  render(
    <MemoryRouter initialEntries={[`/flight/${number}`]}>
      {nextNumber && <GoTo to={`/flight/${nextNumber}`} />}
      <Routes>
        <Route path="/flight/:number" element={<FlightPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const status = () => screen.getByRole('status').textContent;

beforeEach(() => {
  lookup.mockReset();
});

describe('what a screen reader is told', () => {
  it('says a flight is loading, then what came back', async () => {
    lookup.mockResolvedValue(found('BA117', [leg('BA 117')]));

    show('BA117');
    expect(status()).toBe('Loading flight BA117');

    await screen.findByRole('heading', { name: 'BA 117' });
    expect(status()).toBe('1 flight found for BA117');
  });

  it('counts more than one leg under the same number', async () => {
    lookup.mockResolvedValue(found('BA117', [leg('BA 117'), leg('BA 117 2')]));

    show('BA117');

    await screen.findByText('2 flights found for BA117');
  });

  it('says when a number matched nothing', async () => {
    lookup.mockResolvedValue(found('ZZ999', []));

    show('ZZ999');

    await screen.findByText('No flight found for ZZ999');
  });

  it('sends a failure to an alert rather than the polite status', async () => {
    lookup.mockRejectedValue(new Error('down'));

    show('BA117');

    expect((await screen.findByRole('alert')).textContent).toBeTruthy();
    // An error interrupts. A count waits its turn.
    expect(status()).toBe('');
  });
});

describe('loading a second flight', () => {
  it('leaves nothing of the first behind', async () => {
    lookup.mockRejectedValueOnce(new Error('down'));
    lookup.mockResolvedValueOnce(found('BA2', [leg('BA 2')]));

    const user = userEvent.setup();
    show('BA1', 'BA2');

    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'go' }));

    await screen.findByRole('heading', { name: 'BA 2' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(status()).toBe('1 flight found for BA2');
  });
});
