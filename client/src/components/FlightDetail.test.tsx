import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChatDrawer from './ChatDrawer';
import FlightDetail from './FlightDetail';
import { getFlightByNumber } from '../services/api';
import { AssistantContext } from './assistantContext';

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  getFlightByNumber: vi.fn(),
}));

const lookup = vi.mocked(getFlightByNumber);
import type { Flight } from '../models';

const flight = (overrides: Partial<Flight> = {}): Flight => ({
  id: 'BA 117-2026-09-01T08:00:00Z',
  number: 'BA 117',
  airline: 'British Airways',
  direction: 'departure',
  counterpart: { iata: 'JFK', name: 'John F Kennedy', municipality: 'New York' },
  scheduledTime: '2026-09-01T08:00:00Z',
  scheduledLocal: '2026-09-01T09:00+01:00',
  status: 'Expected',
  isCargo: false,
  isCodeshare: false,
  ...overrides,
});

/** The two ends of the route, as a reader would hear them. */
const ends = () => [...document.querySelectorAll('.detail__end')].map((end) => end.textContent ?? '');

function show(overrides: Partial<Flight> = {}, onClose = vi.fn()) {
  const view = render(
    <MemoryRouter>
      <FlightDetail flight={flight(overrides)} airport="LHR" onClose={onClose} />
    </MemoryRouter>,
  );

  return { ...view, onClose };
}

describe('what the panel says', () => {
  it('is named by the flight it is showing', () => {
    show();

    expect(screen.getByRole('dialog', { name: 'BA 117' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'BA 117' })).toBeTruthy();
    expect(screen.getByText('British Airways')).toBeTruthy();
  });

  it('runs a departure from this airport to the other one', () => {
    show();

    const [from, to] = ends();
    expect(from).toContain('LHR');
    expect(to).toContain('JFK');
  });

  it('runs an arrival the other way round', () => {
    show({ direction: 'arrival' });

    const [from, to] = ends();
    expect(from).toContain('JFK');
    expect(to).toContain('LHR');
  });

  it('says which end is which, since the plane between them is not read out', () => {
    show();

    // Without these a screen reader hears "LHR JFK" and has to guess.
    const [from, to] = ends();
    expect(from.startsWith('From')).toBe(true);
    expect(to.startsWith('To')).toBe(true);
  });

  it('links to the flight page for what the board does not carry', () => {
    show();

    const link = screen.getByRole('link', { name: /Full flight details/ });
    // The date is the airport's own, read off the local string.
    expect(link.getAttribute('href')).toBe('/flight/BA%20117?date=2026-09-01');
  });
});

describe('closing it', () => {
  it('closes on the close button', async () => {
    const user = userEvent.setup();
    const { onClose } = show();

    await user.click(screen.getByRole('button', { name: 'Close flight' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const { onClose } = show();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores every other key', () => {
    const { onClose } = show();

    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'ArrowRight' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops listening for Escape once it is gone', () => {
    const { onClose, unmount } = show();
    unmount();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('where focus goes', () => {
  it('moves into the panel when it opens', () => {
    show();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close flight' }));
  });

  it('goes back to whatever opened it', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = show();
    unmount();

    // Otherwise a keyboard reader is dropped at the top of the page, forty
    // cards from where they were.
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});

describe('the facts', () => {
  /** A tile's value, found by its label. */
  function fact(label: string) {
    const term = screen.getByText(label, { selector: 'dt' });
    return term.nextElementSibling as HTMLElement;
  }

  it('shows the scheduled time off the airport clock', () => {
    show();

    expect(fact('Scheduled').textContent).toBe('09:00');
  });

  it('reads a revised time as two facts rather than two numbers', () => {
    show({ revisedLocal: '2026-09-01T09:40+01:00' });

    // "09:00 09:40" on its own is the one thing nobody can afford to misread.
    expect(fact('Scheduled').textContent).toBe('Scheduled 09:00, revised to 09:40');
  });

  it('does not announce a revision that never happened', () => {
    show({ revisedLocal: '2026-09-01T09:00+01:00' });

    expect(fact('Scheduled').textContent).toBe('09:00');
  });

  it('says the status in words and gives it its tone', () => {
    show({ status: 'Delayed' });

    expect(fact('Status').textContent).toBe('Delayed');
    expect(fact('Status').className).toContain('fact__value--warn');
  });

  it('names the terminal the way the board does', () => {
    show({ terminal: '5' });

    expect(fact('Terminal').textContent).toBe('T5');
  });

  it('keeps a tile for a gate that has not been published', () => {
    show({ gate: undefined });

    // Gates publish close to departure. A tile that vanished would read as a
    // layout fault rather than as a fact about the flight.
    expect(fact('Gate').textContent).toBe('Not published');
  });

  it('shows the aircraft, which the board does carry', () => {
    show({ aircraft: 'Boeing 777-300ER' });

    expect(fact('Aircraft').textContent).toBe('Boeing 777-300ER');
  });

  it('shows a check in desk for a departure', () => {
    show({ checkInDesk: '12' });

    expect(fact('Check in').textContent).toBe('Desk 12');
  });

  it('has no check in for an arrival, whose desk was at the other end', () => {
    show({ direction: 'arrival', checkInDesk: '12' });

    expect(screen.queryByText('Check in', { selector: 'dt' })).toBeNull();
  });

  it('shows nothing the schedule does not carry', () => {
    show();

    // The design had a block time here. There is no such field.
    expect(screen.queryByText(/block time/i)).toBeNull();
  });
});

describe('the progress', () => {
  const stages = () =>
    within(screen.getByRole('region', { name: 'Progress' })).queryAllByRole('listitem');

  it('is a section a screen reader can jump to', () => {
    show();

    expect(screen.getByRole('heading', { name: 'Progress' })).toBeTruthy();
  });

  it('says which stages are done in words, not only in colour', () => {
    show({ status: 'Boarding' });

    const [checkIn, boarding, gate] = stages();
    expect(checkIn.textContent).toContain('done');
    expect(boarding.textContent).toContain('done');
    expect(gate.textContent).toContain('not yet');
  });

  it('marks where the flight is now', () => {
    show({ status: 'Boarding' });

    const current = stages().filter((stage) => stage.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain('Boarding');
  });

  it('puts the real departure time on the last stage', () => {
    show({ status: 'Expected', revisedLocal: '2026-09-01T09:40+01:00' });

    expect(stages().at(-1)?.textContent).toContain('scheduled 09:00, revised to 09:40');
  });

  it('shows no time beside boarding or the gate', () => {
    show({ status: 'GateClosed' });

    const [checkIn, boarding, gate] = stages();
    for (const stage of [checkIn, boarding, gate]) {
      expect(stage.textContent).not.toMatch(/\d{2}:\d{2}/);
    }
  });

  it('says a cancelled flight is cancelled instead of listing stages', () => {
    show({ status: 'Canceled' });

    const region = screen.getByRole('region', { name: 'Progress' });
    expect(region.textContent).toContain('Cancelled');
    expect(stages()).toHaveLength(0);
  });
});

describe('asking the assistant about it', () => {
  function showAsking(overrides: Partial<Flight> = {}) {
    const ask = vi.fn();

    render(
      <MemoryRouter>
        <AssistantContext.Provider value={{ request: null, ask }}>
          <FlightDetail flight={flight(overrides)} airport="LHR" onClose={vi.fn()} />
        </AssistantContext.Provider>
      </MemoryRouter>,
    );

    return { ask, user: userEvent.setup() };
  }

  const button = () => screen.getByRole('button', { name: 'Ask the assistant about this flight' });

  it('hands the assistant a question with the flight written into it', async () => {
    const { ask, user } = showAsking({ terminal: '5', gate: 'A15', status: 'Boarding' });

    await user.click(button());

    expect(ask).toHaveBeenCalledWith(
      'I am looking at BA 117, British Airways from LHR to New York (JFK), scheduled 09:00 local time, boarding, terminal 5, gate A15. What should I know about this flight?',
    );
  });

  it('says whose clock the time is on', async () => {
    const { ask, user } = showAsking();

    await user.click(button());

    // "09:00" alone gives a model no way of knowing which zone it is in.
    expect(ask.mock.calls[0][0]).toContain('local time');
  });

  it('includes a revision when there is one', async () => {
    const { ask, user } = showAsking({ revisedLocal: '2026-09-01T09:40+01:00' });

    await user.click(button());

    expect(ask.mock.calls[0][0]).toContain('scheduled 09:00, now 09:40 local time');
  });

  it('leaves out a gate that has not been published rather than guessing one', async () => {
    const { ask, user } = showAsking({ gate: undefined, terminal: undefined });

    await user.click(button());

    // The assistant cannot look flights up. What this sentence tells it is
    // what it knows, so the sentence must not invent anything.
    expect(ask.mock.calls[0][0]).not.toMatch(/gate|terminal/i);
  });

  it('puts an arrival the right way round', async () => {
    const { ask, user } = showAsking({ direction: 'arrival' });

    await user.click(button());

    expect(ask.mock.calls[0][0]).toContain('from New York (JFK) to LHR');
  });
});

describe('checking whether it arrived', () => {
  const leg = (over: Record<string, unknown> = {}) => ({
    id: 'BA 117',
    number: 'BA 117',
    airline: 'British Airways',
    status: 'Arrived',
    departure: { airport: { iata: 'LHR', name: 'Heathrow' }, scheduledTime: '2026-09-01T08:00:00Z' },
    arrival: {
      airport: { iata: 'JFK', name: 'Kennedy' },
      scheduledLocal: '2026-09-01T11:30-04:00',
      revisedLocal: '2026-09-01T11:52-04:00',
    },
    isCargo: false,
    ...over,
  });

  function answer(flights: unknown[] = [leg()]) {
    lookup.mockResolvedValue({ number: 'BA 117', count: flights.length, flights } as never);
  }

  const check = () => screen.getByRole('button', { name: 'Check arrival' });

  beforeEach(() => {
    lookup.mockReset();
  });

  it('asks nothing until it is asked', () => {
    show();

    // A reader working through a board would spend a month of allowance in
    // an afternoon if this fetched on open.
    expect(lookup).not.toHaveBeenCalled();
    expect(check()).toBeTruthy();
  });

  it('says what pressing it will do', () => {
    show();

    expect(screen.getByText(/Asks about this one flight/)).toBeTruthy();
  });

  it('asks about this flight on this date', async () => {
    answer();
    const user = userEvent.setup();
    show();

    await user.click(check());

    expect(lookup).toHaveBeenCalledWith('BA 117', '2026-09-01');
  });

  it('says it landed, where, and when', async () => {
    answer();
    const user = userEvent.setup();
    show();

    await user.click(check());

    const arrival = await screen.findByRole('region', { name: 'Arrival' });
    expect(arrival.textContent).toContain('Arrived');
    expect(arrival.textContent).toContain('JFK');
    expect(arrival.textContent).toContain('11:52');
  });

  it('names the time as revised rather than as the schedule', async () => {
    answer();
    const user = userEvent.setup();
    show();

    await user.click(check());

    expect((await screen.findByRole('region', { name: 'Arrival' })).textContent).toContain('Revised');
  });

  it('asks once, not again on every render', async () => {
    answer();
    const user = userEvent.setup();
    show();

    await user.click(check());
    await screen.findByText(/Arrived/);

    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('says so when the number is not being tracked', async () => {
    answer([]);
    const user = userEvent.setup();
    show();

    await user.click(check());

    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('says so when the request fails', async () => {
    lookup.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    show();

    await user.click(check());

    // And leaves the button there, since the next press may work.
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(check()).toBeTruthy();
  });
});

describe('an arrival that is already known', () => {
  const landed = {
    status: 'Arrived' as const,
    time: '11:52',
    kind: 'Revised' as const,
    airport: { iata: 'JFK', name: 'Kennedy', municipality: 'New York' },
  };

  function showKnown() {
    render(
      <MemoryRouter>
        <AssistantContext.Provider value={{ request: null, ask: vi.fn() }}>
          <FlightDetail flight={flight()} airport="LHR" onClose={vi.fn()} arrival={landed} />
        </AssistantContext.Provider>
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    lookup.mockReset();
  });

  it('shows it without asking again', () => {
    showKnown();

    // Reopening a flight already checked must not spend a second unit.
    expect(screen.getByRole('region', { name: 'Arrival' }).textContent).toContain('Arrived');
    expect(screen.queryByRole('button', { name: 'Check arrival' })).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it('hands what it learns back to the page', async () => {
    lookup.mockResolvedValue({
      number: 'BA 117',
      count: 1,
      flights: [
        {
          id: 'BA 117',
          number: 'BA 117',
          airline: 'British Airways',
          status: 'Arrived',
          departure: { airport: { iata: 'LHR', name: 'Heathrow' }, scheduledTime: '2026-09-01T08:00:00Z' },
          arrival: { airport: { iata: 'JFK', name: 'Kennedy' }, revisedLocal: '2026-09-01T11:52-04:00' },
          isCargo: false,
        },
      ],
    } as never);

    const onChecked = vi.fn();
    render(
      <MemoryRouter>
        <AssistantContext.Provider value={{ request: null, ask: vi.fn() }}>
          <FlightDetail flight={flight()} airport="LHR" onClose={vi.fn()} onChecked={onChecked} />
        </AssistantContext.Provider>
      </MemoryRouter>,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: 'Check arrival' }));

    // So the board can wear it, and so it is never asked twice.
    await waitFor(() => expect(onChecked).toHaveBeenCalledTimes(1));
    expect(onChecked.mock.calls[0][1]).toMatchObject({ status: 'Arrived', time: '11:52' });
  });
});

describe('an arrival that lands after the panel has moved on', () => {
  const leg = (number: string, iata: string, time: string) => ({
    id: number,
    number,
    airline: 'British Airways',
    status: 'Arrived',
    departure: { airport: { iata: 'LHR', name: 'Heathrow' }, scheduledTime: '2026-09-01T08:00:00Z' },
    arrival: { airport: { iata, name: iata }, revisedLocal: `2026-09-01T${time}-04:00` },
    isCargo: false,
  });

  /** A request the test decides when to answer. */
  function deferred() {
    let settle: (value: unknown) => void = () => {};
    const promise = new Promise((resolve) => {
      settle = resolve;
    });
    return { promise, settle };
  }

  function showPanel(flightOver: Partial<Flight>, onChecked = vi.fn()) {
    const view = render(
      <MemoryRouter>
        <AssistantContext.Provider value={{ request: null, ask: vi.fn() }}>
          <FlightDetail
            flight={flight(flightOver)}
            airport="LHR"
            onClose={vi.fn()}
            onChecked={onChecked}
          />
        </AssistantContext.Provider>
      </MemoryRouter>,
    );

    return { view, onChecked, user: userEvent.setup() };
  }

  beforeEach(() => {
    lookup.mockReset();
  });

  it('does not show one flight arrival on another flight panel', async () => {
    const slow = deferred();
    lookup.mockReturnValue(slow.promise as never);

    const { view, user } = showPanel({ id: 'a', number: 'BA 117' });
    await user.click(screen.getByRole('button', { name: 'Check arrival' }));

    // The reader presses another card while the first answer is in the air.
    view.rerender(
      <MemoryRouter>
        <AssistantContext.Provider value={{ request: null, ask: vi.fn() }}>
          <FlightDetail
            flight={flight({ id: 'b', number: 'BA 999' })}
            airport="LHR"
            onClose={vi.fn()}
            onChecked={vi.fn()}
          />
        </AssistantContext.Provider>
      </MemoryRouter>,
    );

    await act(async () => {
      slow.settle({ number: 'BA 117', count: 1, flights: [leg('BA 117', 'JFK', '11:52')] });
    });

    // BA 117 landed at JFK. BA 999 did not, and must not say it did.
    const arrival = screen.getByRole('region', { name: 'Arrival' });
    expect(arrival.textContent).not.toContain('JFK');
    expect(within(arrival).getByRole('button', { name: 'Check arrival' })).toBeTruthy();
  });

  it('still remembers it for the flight that asked', async () => {
    const slow = deferred();
    lookup.mockReturnValue(slow.promise as never);

    const onChecked = vi.fn();
    const { view, user } = showPanel({ id: 'a', number: 'BA 117' }, onChecked);
    await user.click(screen.getByRole('button', { name: 'Check arrival' }));

    view.rerender(
      <MemoryRouter>
        <AssistantContext.Provider value={{ request: null, ask: vi.fn() }}>
          <FlightDetail
            flight={flight({ id: 'b', number: 'BA 999' })}
            airport="LHR"
            onClose={vi.fn()}
            onChecked={onChecked}
          />
        </AssistantContext.Provider>
      </MemoryRouter>,
    );

    await act(async () => {
      slow.settle({ number: 'BA 117', count: 1, flights: [leg('BA 117', 'JFK', '11:52')] });
    });

    // The unit was spent and the answer is true. The board wears it on BA
    // 117's card, and a second look at that flight costs nothing.
    expect(onChecked).toHaveBeenCalledTimes(1);
    expect(onChecked.mock.calls[0][0].id).toBe('a');
    expect(onChecked.mock.calls[0][1]).toMatchObject({ airport: { iata: 'JFK' } });
  });

  it('does not report a failure onto the flight that is showing', async () => {
    const slow = deferred();
    lookup.mockReturnValue(
      slow.promise.then(() => {
        throw new Error('offline');
      }) as never,
    );

    const { view, user } = showPanel({ id: 'a', number: 'BA 117' });
    await user.click(screen.getByRole('button', { name: 'Check arrival' }));

    view.rerender(
      <MemoryRouter>
        <AssistantContext.Provider value={{ request: null, ask: vi.fn() }}>
          <FlightDetail
            flight={flight({ id: 'b', number: 'BA 999' })}
            airport="LHR"
            onClose={vi.fn()}
            onChecked={vi.fn()}
          />
        </AssistantContext.Provider>
      </MemoryRouter>,
    );

    await act(async () => {
      slow.settle(null);
    });

    // Someone else's failure is not this flight's news.
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('escape with the assistant open over it', () => {
  /** The panel and the drawer together, which is how the board renders them. */
  function showBoth(onClose = vi.fn()) {
    render(
      <MemoryRouter>
        <AssistantContext.Provider value={{ request: null, ask: vi.fn() }}>
          <FlightDetail flight={flight()} airport="LHR" onClose={onClose} />
          <ChatDrawer />
        </AssistantContext.Provider>
      </MemoryRouter>,
    );

    return { onClose, user: userEvent.setup() };
  }

  const panel = () => screen.queryByRole('dialog', { name: 'BA 117' });

  it('closes the assistant and leaves the flight open', async () => {
    const { onClose, user } = showBoth();

    await user.click(screen.getByRole('button', { name: 'Travel assistant' }));
    expect(screen.getByLabelText('Your message')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    // One press used to close both, so shutting the drawer took the flight
    // being read away with it.
    await waitFor(() => expect(screen.queryByLabelText('Your message')).toBeNull());
    expect(onClose).not.toHaveBeenCalled();
    expect(panel()).toBeTruthy();
  });

  it('closes the flight once the assistant is out of the way', async () => {
    const { onClose, user } = showBoth();

    await user.click(screen.getByRole('button', { name: 'Travel assistant' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('Your message')).toBeNull());

    fireEvent.keyDown(document, { key: 'Escape' });

    // The second press reaches the layer underneath.
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('still closes the flight when nothing is over it', () => {
    const { onClose } = showBoth();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('the progress once the arrival has been checked', () => {
  const enRoute = {
    status: 'EnRoute' as const,
    time: '11:52',
    kind: 'Revised' as const,
    airport: { iata: 'JFK', name: 'Kennedy', municipality: 'New York' },
  };

  function showArriving(arrival?: typeof enRoute) {
    render(
      <MemoryRouter>
        <AssistantContext.Provider value={{ request: null, ask: vi.fn() }}>
          <FlightDetail
            flight={flight({ direction: 'arrival', status: 'Expected' })}
            airport="LHR"
            onClose={vi.fn()}
            arrival={arrival}
          />
        </AssistantContext.Provider>
      </MemoryRouter>,
    );
  }

  const stages = () =>
    within(screen.getByRole('region', { name: 'Progress' })).queryAllByRole('listitem');

  it('lights what the check revealed', () => {
    showArriving(enRoute);

    // The panel used to say En route in one block and show nothing reached in
    // the next, which is the same panel disagreeing with itself.
    const [departed, route] = stages();
    expect(departed.textContent).toContain('done');
    expect(route.textContent).toContain('done');
  });

  it('shows nothing reached until it is checked', () => {
    showArriving();

    // Honest: the arrivals board genuinely does not know where it is.
    for (const stage of stages()) expect(stage.textContent).toContain('not yet');
  });
});
