import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from './ToastProvider';
import { useToast, type ToastTone } from './toastContext';

/*
 * AnimatePresence keeps a leaving element mounted until its exit animation
 * finishes, and that animation runs on a frame loop these fake timers do not
 * drive. What is under test here is the timer bookkeeping and the stack, so the
 * wait for the fade is removed rather than worked around.
 */
vi.mock('framer-motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('framer-motion')>()),
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

/**
 * fireEvent rather than userEvent, and fake timers throughout: the whole point
 * of a toast is what it does after six seconds of nobody touching it.
 */
function Trigger({ message, tone }: { message: string; tone?: ToastTone }) {
  const show = useToast();
  return (
    <button type="button" onClick={() => show({ message, tone })}>
      show {message}
    </button>
  );
}

function withToasts(messages: string[]) {
  render(
    <ToastProvider>
      {messages.map((message) => (
        <Trigger key={message} message={message} />
      ))}
    </ToastProvider>,
  );
}

const raise = (message: string) =>
  fireEvent.click(screen.getByRole('button', { name: `show ${message}` }));

/** Long enough for the dismissal and the exit animation behind it. */
const settle = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('raising a toast', () => {
  it('shows what it was given', () => {
    withToasts(['Allowance spent']);

    raise('Allowance spent');

    expect(screen.getByText('Allowance spent')).toBeTruthy();
  });

  it('has somewhere to announce into before there is anything to say', () => {
    withToasts(['Allowance spent']);

    // Always mounted, so the first toast is announced rather than arriving with
    // the region that would have announced it.
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');
  });

  it('says the same condition once, not once per attempt', () => {
    withToasts(['Rate limited']);

    raise('Rate limited');
    raise('Rate limited');
    raise('Rate limited');

    expect(screen.getAllByText('Rate limited')).toHaveLength(1);
  });

  it('still says a different thing', () => {
    withToasts(['Rate limited', 'Allowance spent']);

    raise('Rate limited');
    raise('Allowance spent');

    expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(2);
  });
});

describe('getting rid of a toast', () => {
  it('takes itself away after six seconds', () => {
    withToasts(['Allowance spent']);

    raise('Allowance spent');
    expect(screen.getByText('Allowance spent')).toBeTruthy();

    settle(6000);
    settle(500);

    expect(screen.queryByText('Allowance spent')).toBeNull();
  });

  it('goes when it is dismissed by hand', () => {
    withToasts(['Allowance spent']);

    raise('Allowance spent');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    settle(500);

    expect(screen.queryByText('Allowance spent')).toBeNull();
  });

  it('does not come back when its timer would have fired', () => {
    withToasts(['Allowance spent']);

    raise('Allowance spent');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    settle(500);

    // The timer for a toast already gone must not resurrect or disturb it.
    settle(6000);

    expect(screen.queryByText('Allowance spent')).toBeNull();
  });
});

describe('more than the stack can hold', () => {
  it('keeps three and drops the oldest', () => {
    withToasts(['One', 'Two', 'Three', 'Four']);

    raise('One');
    raise('Two');
    raise('Three');
    raise('Four');
    settle(500);

    // Four conditions at once covers the page it is describing.
    expect(screen.queryByText('One')).toBeNull();
    expect(screen.getByText('Four')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(3);
  });
});
