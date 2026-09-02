import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChatDrawer from './ChatDrawer';
import { sendChat } from '../services/api';

vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/api')>()),
  sendChat: vi.fn(),
}));

const chat = vi.mocked(sendChat);

const QUESTION = 'How early should I get there?';
const SEARCH = '/?airport=LHR&direction=departure&from=2026-09-01T08:00&to=2026-09-01T12:00';

function show(url = '/') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <ChatDrawer />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

const toggle = () => screen.getByRole('button', { name: 'Travel assistant' });
const box = () => screen.getByLabelText('Your message');

async function open(url = '/') {
  const user = show(url);
  await user.click(toggle());
  return user;
}

async function askQuestion(user: ReturnType<typeof userEvent.setup>, text = QUESTION) {
  await user.type(box(), text);
  await user.click(screen.getByRole('button', { name: 'Send message' }));
}

beforeEach(() => {
  chat.mockReset();
});

describe('opening and closing', () => {
  it('stays out of the way until it is asked for', () => {
    show();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on the button and puts the cursor where you type', async () => {
    await open();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.activeElement).toBe(box());
  });

  it('closes on Escape and hands focus back', async () => {
    const user = await open();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Focus must not be left on an element that no longer exists.
    expect(document.activeElement).toBe(toggle());
  });

  it('closes on the close button', async () => {
    const user = await open();

    await user.click(screen.getByRole('button', { name: 'Close travel assistant' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('the airport it is looking at', () => {
  it('passes the searched airport as context', async () => {
    chat.mockResolvedValue('About two hours.');
    const user = await open(SEARCH);

    await askQuestion(user, 'How early should I get here?');

    await waitFor(() => expect(chat).toHaveBeenCalledTimes(1));
    // "here" only means something because this went with it.
    expect(chat).toHaveBeenLastCalledWith(expect.anything(), 'LHR');
  });

  it('says so, so nobody has to guess what it knows', async () => {
    await open(SEARCH);

    expect(screen.getByText('Knows you are looking at LHR.')).toBeTruthy();
  });

  it('sends nothing when no airport is being looked at', async () => {
    chat.mockResolvedValue('Depends where.');
    const user = await open('/');

    await askQuestion(user);

    await waitFor(() => expect(chat).toHaveBeenCalledTimes(1));
    expect(chat).toHaveBeenLastCalledWith(expect.anything(), undefined);
  });

  it('ignores a URL that is not carrying a real code', async () => {
    chat.mockResolvedValue('Depends where.');
    const user = await open('/?airport=nonsense');

    await askQuestion(user);

    await waitFor(() => expect(chat).toHaveBeenLastCalledWith(expect.anything(), undefined));
  });
});

describe('asking a question', () => {
  it('shows the question and the answer', async () => {
    chat.mockResolvedValue('Two hours is plenty.');
    const user = await open();

    await askQuestion(user);

    expect(await screen.findByText('Two hours is plenty.')).toBeTruthy();
    expect(screen.getByText(QUESTION)).toBeTruthy();
  });

  it('sends only the roles and text, never the timestamps', async () => {
    chat.mockResolvedValue('Fine.');
    const user = await open();

    await askQuestion(user);

    await waitFor(() => expect(chat).toHaveBeenCalledTimes(1));
    expect(chat).toHaveBeenCalledWith(
      [expect.objectContaining({ role: 'user', content: QUESTION })],
      undefined,
    );
  });

  it('will not send an empty draft', async () => {
    await open();

    expect(screen.getByRole('button', { name: 'Send message' })).toHaveProperty('disabled', true);
    expect(chat).not.toHaveBeenCalled();
  });

  it('asks an opener straight off', async () => {
    chat.mockResolvedValue('Get there early.');
    const user = await open();

    await user.click(screen.getByRole('button', { name: /How early should I get to the airport/ }));

    await waitFor(() => expect(chat).toHaveBeenCalledTimes(1));
  });
});

describe('the keyboard', () => {
  it('sends on Enter', async () => {
    chat.mockResolvedValue('Yes.');
    const user = await open();

    await user.type(box(), 'Anything?{Enter}');

    await waitFor(() => expect(chat).toHaveBeenCalledTimes(1));
  });

  it('breaks the line on shift and Enter', async () => {
    const user = await open();

    await user.type(box(), 'One{Shift>}{Enter}{/Shift}two');

    expect((box() as HTMLTextAreaElement).value).toBe('One\ntwo');
    expect(chat).not.toHaveBeenCalled();
  });
});

describe('when the answer does not arrive', () => {
  it('says so and keeps the question', async () => {
    chat.mockRejectedValue(new Error('down'));
    const user = await open();

    await askQuestion(user);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(QUESTION)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('retries without asking the question twice', async () => {
    chat.mockRejectedValueOnce(new Error('down'));
    chat.mockResolvedValueOnce('Two hours.');
    const user = await open();

    await askQuestion(user);
    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Two hours.')).toBeTruthy();

    // The question belongs in the conversation once. Retrying is the same
    // question again, not a second one.
    expect(screen.getAllByText(QUESTION)).toHaveLength(1);
  });
});
