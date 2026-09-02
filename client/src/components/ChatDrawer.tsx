import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, ChatCircleDots, WarningCircle, X } from '@phosphor-icons/react';

import type { Message } from '../models';
import { useToast } from './toastContext';
import { errorStatus, messageFromError, sendChat } from '../services/api';
import './ChatDrawer.css';

/** Matches the server's per-message cap, so the limit bites here first. */
const MAX_CHARS = 2000;

/** The server caps history too; trimming here keeps the request inside it. */
const MAX_HISTORY = 20;

/** Statuses that describe the whole app rather than this one request. */
const SITE_WIDE = new Set([429, 503]);

/**
 * Ties the button and the panel together as one surface, so the panel grows
 * out of the button rather than appearing beside it. Both are anchored to the
 * same corner, which is what makes the morph read as one object opening.
 */
const MORPH_ID = 'chat-surface';

/** Quick enough to feel like a response, soft enough not to snap. */
const MORPH = { type: 'spring', stiffness: 380, damping: 34 } as const;

/** Long enough to read as the colour arriving, short enough to keep up. */
const WASH = { duration: 0.24, ease: [0.16, 1, 0.3, 1] } as const;

/** Corner radius as numbers, so the morph interpolates them without distorting. */
const FAB_RADIUS = 28;
const PANEL_RADIUS = 14;

const OPENERS = [
  'How early should I get to the airport for a long haul flight?',
  'What is the difference between Schengen and non-Schengen gates?',
  'Can I bring a power bank in hand luggage?',
];

function now() {
  return new Date().toISOString();
}

/**
 * The travel assistant, as a drawer rather than a page.
 *
 * A page meant leaving the flight board to ask a question about it and coming
 * back to an empty form. Here the board stays where it was, and the airport it
 * is showing goes along as context, so "how early should I get here" has an
 * answer without anyone having to say where here is.
 */
export default function ChatDrawer() {
  const showToast = useToast();
  const [searchParams] = useSearchParams();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const reduceMotion = useReducedMotion();

  /*
   * The airport the board is showing, read from the URL rather than passed
   * down. The search already lives there, so this stays in step through a back
   * button, a refresh and a shared link with no wiring at all.
   */
  const code = (searchParams.get('airport') ?? '').toUpperCase();
  const airport = /^[A-Z]{3}$/.test(code) ? code : undefined;

  // Follow the conversation as it grows, the way a chat is expected to behave.
  useEffect(() => {
    if (!open) return;
    logEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messages, isSending, open, reduceMotion]);

  /** Focus follows the panel, and comes back to the button it grew out of. */
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (wasOpen.current) {
      toggleRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  /**
   * Takes the conversation to build on rather than always reading state,
   * because a caller that has just trimmed the log cannot wait for the trim to
   * land. State updates are not visible until the next render, and this
   * function closes over the current one.
   */
  async function ask(question: string, conversation: Message[] = messages) {
    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    const outgoing: Message = { role: 'user', content: trimmed, timestamp: now() };
    const history = [...conversation, outgoing].slice(-MAX_HISTORY);

    setMessages(history);
    setDraft('');
    setError(null);
    setIsSending(true);

    try {
      const reply = await sendChat(history, airport);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: reply, timestamp: now() },
      ]);
    } catch (caught) {
      const message = messageFromError(caught);
      setError(message);

      // Same reasoning as the flights page: a site condition gets said twice,
      // once in place and once out of band.
      if (SITE_WIDE.has(errorStatus(caught) ?? 0)) showToast({ message });
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  /** Enter sends, shift and enter breaks the line, which is what people expect. */
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void ask(draft);
    }
  }

  /** Resend the last question without making the user retype it. */
  function retry() {
    const lastQuestion = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastQuestion) return;

    // Everything before the question that failed, handed over directly. Setting
    // it here and letting ask read it back would ask the same question twice:
    // the trim is queued, and ask sees the log as it was.
    const before = messages.slice(0, messages.lastIndexOf(lastQuestion));
    void ask(lastQuestion.content, before);
  }

  // No shared id under reduced motion: the two states simply swap, with no
  // travel between them for anyone who asked not to see any.
  const morphId = reduceMotion ? undefined : MORPH_ID;
  const morph = reduceMotion ? { duration: 0 } : MORPH;

  if (!open) {
    return (
      <motion.button
        layoutId={morphId}
        ref={toggleRef}
        type="button"
        className="chat__toggle"
        style={{ borderRadius: FAB_RADIUS }}
        transition={morph}
        onClick={() => setOpen(true)}
        aria-label="Travel assistant"
      >
        {/*
          The accent arrives as opacity over the panel's own background rather
          than as a background swap. A layout morph moves the box but not the
          colour, so closing used to land a full size orange rectangle on
          screen for a frame before it shrank. Opacity is also the only way to
          animate this at all: the palette is oklch, which does not
          interpolate.
        */}
        <motion.span
          className="chat__wash"
          aria-hidden="true"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={WASH}
        />

        <motion.span
          className="chat__toggleIcon"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.14, delay: reduceMotion ? 0 : 0.08 }}
        >
          <ChatCircleDots size={24} weight="fill" aria-hidden="true" />
        </motion.span>
      </motion.button>
    );
  }

  return (
    <motion.div
      layoutId={morphId}
      className="chat"
      role="dialog"
      aria-label="Travel assistant"
      style={{ borderRadius: PANEL_RADIUS }}
      transition={morph}
    >
      {/*
        The contents fade in after the shape has most of the way opened.
        Carrying them through the morph would stretch them with it.
      */}
      <motion.div
        className="chat__body"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, delay: reduceMotion ? 0 : 0.1 }}
      >
        <header className="chat__head">
          <div>
            <h2 className="chat__title">Travel assistant</h2>
            <p className="chat__context">
              {airport
                ? `Knows you are looking at ${airport}.`
                : 'Airports, baggage, what to expect.'}
            </p>
          </div>

          <button
            type="button"
            className="chat__close"
            onClick={() => setOpen(false)}
            aria-label="Close travel assistant"
          >
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </header>

        <div
          className="chat__log"
          role="log"
          aria-live="polite"
          aria-busy={isSending}
          aria-label="Conversation"
        >
          {messages.length === 0 && (
            <div className="chat__empty">
              <p className="chat__emptyText">Nothing asked yet. Try one of these:</p>
              <ul className="chat__openers">
                {OPENERS.map((opener) => (
                  <li key={opener}>
                    <button type="button" className="chat__opener" onClick={() => void ask(opener)}>
                      {opener}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={`${message.timestamp}-${message.role}`}
                className={`bubble bubble--${message.role}`}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Rendered as text, never as markup: this is model output. */}
                {message.content}
              </motion.div>
            ))}
          </AnimatePresence>

          {isSending && (
            <div className="bubble bubble--assistant chat__thinking" aria-label="Thinking">
              <span className="chat__dot" />
              <span className="chat__dot" />
              <span className="chat__dot" />
            </div>
          )}

          {error && (
            <div className="chat__error" role="alert">
              <WarningCircle size={16} weight="fill" aria-hidden="true" />
              <span>{error}</span>
              <button type="button" className="chat__retry" onClick={retry}>
                Try again
              </button>
            </div>
          )}

          <div ref={logEndRef} />
        </div>

        <form className="chat__composer" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="chat-input">
            Your message
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            className="chat__input"
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, MAX_CHARS))}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your trip"
            rows={1}
            maxLength={MAX_CHARS}
            disabled={isSending}
          />
          <button
            type="submit"
            className="chat__send"
            disabled={isSending || draft.trim().length === 0}
            aria-label="Send message"
          >
            <ArrowUp size={18} weight="bold" aria-hidden="true" />
          </button>
        </form>

        <p className="chat__note">
          No live flight data here. The flight board has status, gates and schedules.
        </p>
      </motion.div>
    </motion.div>
  );
}
