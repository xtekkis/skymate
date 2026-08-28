import { Component, type ErrorInfo, type ReactNode } from 'react';

import MessageScreen from './MessageScreen';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Catches a render that throws.
 *
 * Without one, React unmounts the whole tree and leaves a blank page, which
 * looks like the site is down rather than like one screen broke. A class is
 * required here: there is no hook equivalent of componentDidCatch.
 *
 * The error text stays in the console. On screen it would mean nothing to a
 * traveller and could carry internals, which is the same reasoning the server
 * uses for 5xx responses.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[skymate] a render failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <MessageScreen
        title="Something went wrong"
        body="Skymate hit an error it could not recover from. Reloading usually clears it, and your searches are not saved so nothing is lost."
        action={
          // A full reload rather than a route change: the component that threw
          // is still mounted, and only a fresh start reliably clears it.
          <button
            type="button"
            className="message__button"
            onClick={() => window.location.assign('/')}
          >
            Reload Skymate
          </button>
        }
      />
    );
  }
}
