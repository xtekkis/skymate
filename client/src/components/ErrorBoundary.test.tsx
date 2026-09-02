import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../App';
import ErrorBoundary from './ErrorBoundary';
import { searchAirports } from '../services/api';

/*
 * The assistant is made to throw on render. Mocks are per file, so no other
 * test sees this, and it lets the whole chain be exercised: a page fails, the
 * header is still there, and clicking it has to actually get you out.
 */
vi.mock('../pages/AssistantPage', () => ({
  default: () => {
    throw new Error('the assistant exploded');
  },
}));

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  searchAirports: vi.fn(),
  searchFlights: vi.fn(),
}));

function Boom(): never {
  throw new Error('render failed');
}

const FAILED = 'Something went wrong';

beforeEach(() => {
  // React reports a caught error on the console as well as to the boundary.
  // Silenced so a passing run does not look like a failing one.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(searchAirports).mockResolvedValue([]);
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a render that throws', () => {
  it('stays out of the way when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>the page</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('the page')).toBeTruthy();
  });

  it('shows a page instead of a blank screen', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: FAILED })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reload Skymate' })).toBeTruthy();
  });

  it('keeps the reason in the console, not on the screen', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(console.error).toHaveBeenCalled();
    // The same reasoning the server uses for a 5xx: internals are for logs.
    expect(document.body.textContent).not.toContain('render failed');
  });
});

describe('getting out of a failure', () => {
  it('clears when the key it was given changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/assistant">
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: FAILED })).toBeTruthy();

    rerender(
      <ErrorBoundary resetKey="/">
        <p>the next page</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('the next page')).toBeTruthy();
  });

  it('stays failed while the key does not change', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="/assistant">
        <Boom />
      </ErrorBoundary>,
    );

    rerender(
      <ErrorBoundary resetKey="/assistant">
        <p>the next page</p>
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: FAILED })).toBeTruthy();
  });
});

describe('the header outside the boundary', () => {
  it('is a real way out of a page that threw', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'Assistant' }));
    expect(await screen.findByRole('heading', { name: FAILED })).toBeTruthy();

    // The point of putting the header outside the boundary. Without a reset it
    // is a navigation that changes the URL and nothing else.
    await user.click(screen.getByRole('link', { name: 'Flights' }));

    expect(await screen.findByRole('heading', { name: 'Flight schedules' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: FAILED })).toBeNull();
  });
});
