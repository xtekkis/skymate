import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUp, WarningCircle } from '@phosphor-icons/react';

import type { Message } from '../models';
import { useToast } from '../components/toastContext';
import { errorStatus, messageFromError, sendChat } from '../services/api';
import './AssistantPage.css';

/** Matches the server's per-message cap, so the limit bites here first. */
const MAX_CHARS = 2000;

/** The server caps history too; trimming here keeps the request inside it. */
const MAX_HISTORY = 20;

/** Statuses that describe the whole app rather than this one request. */
const SITE_WIDE = new Set([429, 503]);


const OPENERS = [
  'How early should I get to Heathrow for a long haul flight?',
  'What is the difference between Schengen and non-Schengen gates?',
  'Can I bring a power bank in hand luggage?',
];

function now() {
  return new Date().toISOString();
}

export default function AssistantPage() {
  const showToast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reduceMotion = useReducedMotion();

  // Follow the conversation as it grows, the way a chat is expected to behave.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messages, isSending, reduceMotion]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isSending) return;

    const outgoing: Message = { role: 'user', content: trimmed, timestamp: now() };
    const history = [...messages, outgoing].slice(-MAX_HISTORY);

    setMessages(history);
    setDraft('');
    setError(null);
    setIsSending(true);

    try {
      const reply = await sendChat(history);
      setMessages((current) => [...current, { role: 'assistant', content: reply, timestamp: now() }]);
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

    setMessages((current) => current.slice(0, current.lastIndexOf(lastQuestion)));
    void ask(lastQuestion.content);
  }

  return (
    <main id="main" tabIndex={-1} className="assistant">
      <div className="assistant__inner">
        <div className="assistant__intro">
          <h1>Travel assistant</h1>
          <p className="assistant__lead">
            Ask about airports, baggage, connections, or what to expect on the day.
          </p>
        </div>

        <div
          className="assistant__log"
          role="log"
          aria-live="polite"
          aria-busy={isSending}
          aria-label="Conversation"
        >
          {messages.length === 0 && (
            <div className="assistant__empty">
              <p className="assistant__emptyText">Nothing asked yet. Try one of these:</p>
              <ul className="assistant__openers">
                {OPENERS.map((opener) => (
                  <li key={opener}>
                    <button
                      type="button"
                      className="assistant__opener"
                      onClick={() => void ask(opener)}
                    >
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
            <div className="bubble bubble--assistant assistant__thinking" aria-label="Thinking">
              <span className="assistant__dot" />
              <span className="assistant__dot" />
              <span className="assistant__dot" />
            </div>
          )}

          {error && (
            <div className="assistant__error" role="alert">
              <WarningCircle size={16} weight="fill" aria-hidden="true" />
              <span>{error}</span>
              <button type="button" className="assistant__retry" onClick={retry}>
                Try again
              </button>
            </div>
          )}

          <div ref={logEndRef} />
        </div>

        <form className="assistant__composer" onSubmit={handleSubmit}>
          <label className="visually-hidden" htmlFor="assistant-input">
            Your message
          </label>
          <textarea
            id="assistant-input"
            ref={inputRef}
            className="assistant__input"
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
            className="assistant__send"
            disabled={isSending || draft.trim().length === 0}
            aria-label="Send message"
          >
            <ArrowUp size={18} weight="bold" aria-hidden="true" />
          </button>
        </form>

        <p className="assistant__note">
          No live flight data here. Use Flights for status, gates and schedules.
        </p>
      </div>
    </main>
  );
}
