import { createContext, useContext } from 'react';

/**
 * A question waiting to be put in front of the assistant.
 *
 * The id makes asking the same thing twice a second request rather than no
 * change at all, so a reader who closes the drawer and presses the button
 * again gets it back.
 */
export interface AssistantRequest {
  id: number;
  draft: string;
}

interface AssistantValue {
  request: AssistantRequest | null;
  /** Opens the drawer with this already typed. Never sends it. */
  ask: (draft: string) => void;
}

/**
 * How the rest of the app reaches the assistant.
 *
 * The drawer lives beside the pages rather than inside them, so that a page
 * which throws does not take the conversation with it. That also means no page
 * can reach it through props. This is the one way in.
 *
 * It fills in a question and stops. Sending is left to the reader, because
 * every message costs part of a fixed monthly allowance, and a button that
 * spent it on their behalf would be spending money they had not chosen to.
 *
 * Separate from the provider because a file that exports both a component and
 * a context cannot be hot reloaded.
 */
export const AssistantContext = createContext<AssistantValue>({
  request: null,
  ask: () => {},
});

export function useAssistant() {
  return useContext(AssistantContext);
}
