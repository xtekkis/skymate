import { createContext, useContext } from 'react';

export type ToastTone = 'error' | 'info';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
}

/**
 * Toasts are for conditions that affect the whole app, such as the flight data
 * allowance running out or a rate limit being hit. Anything a single form got
 * wrong stays inline next to the field, where it belongs.
 *
 * Separate from the provider because a file that exports both a component and a
 * context cannot be hot reloaded.
 */
export const ToastContext = createContext<(options: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}
