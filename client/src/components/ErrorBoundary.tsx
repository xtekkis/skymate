import { Component, type ErrorInfo, type ReactNode } from 'react';

import MessageScreen from './MessageScreen';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * A failure is cleared whenever this changes. Pass the route: without it a
   * boundary stays failed forever, and the header sitting outside it is a
   * promise of a way out that does nothing.
   */
  resetKey?: string;
}

interface ErrorBoundaryState {
  failed: boolean;
  /** The key the current failure belongs to, so a new one can be spotted. */
  seenKey?: string;
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

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true };
  }

  /**
   * Clears a failure when the key changes.
   *
   * Derived from props rather than set in componentDidUpdate: doing it after
   * the update means rendering the error screen once more before replacing it,
   * and React rightly warns about that.
   */
  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey === state.seenKey) return null;

    // Going somewhere else is a way out. If the new page throws too, this
    // catches that on its own and shows the screen again.
    return { failed: false, seenKey: props.resetKey };
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
