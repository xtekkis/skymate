import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

import { AssistantContext, type AssistantRequest } from './assistantContext';

/** Holds the one question waiting for the drawer to pick up. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<AssistantRequest | null>(null);
  const next = useRef(0);

  const ask = useCallback((draft: string) => {
    next.current += 1;
    setRequest({ id: next.current, draft });
  }, []);

  // Stable unless a question actually arrives, so every page under this does
  // not re-render whenever the provider does.
  const value = useMemo(() => ({ request, ask }), [request, ask]);

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
