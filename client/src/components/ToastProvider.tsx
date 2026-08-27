import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Info, WarningCircle, X } from '@phosphor-icons/react';

import { ToastContext, type ToastOptions, type ToastTone } from './toastContext';
import './Toast.css';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

/** Long enough to read a sentence without hurrying. */
const DISMISS_MS = 6000;

/** Beyond this the stack covers the page it is describing. */
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const reduceMotion = useReducedMotion();

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    ({ message, tone = 'error' }: ToastOptions) => {
      const id = nextId.current++;

      setToasts((current) => {
        // The same message twice in a row is one condition, not two.
        if (current.some((toast) => toast.message === message)) return current;
        return [...current, { id, message, tone }].slice(-MAX_VISIBLE);
      });

      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DISMISS_MS),
      );
    },
    [dismiss],
  );

  // Clear pending timers if the provider ever unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}

      {/*
        role="status" with aria-live polite, never alert: a toast must not steal
        focus or interrupt what someone is typing.
      */}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className={`toast toast--${toast.tone}`}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {toast.tone === 'error' ? (
                <WarningCircle size={18} weight="fill" aria-hidden="true" />
              ) : (
                <Info size={18} weight="fill" aria-hidden="true" />
              )}

              <p className="toast__message">{toast.message}</p>

              <button
                type="button"
                className="toast__close"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} weight="bold" aria-hidden="true" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
