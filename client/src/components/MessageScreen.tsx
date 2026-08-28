import type { ReactNode } from 'react';

import './MessageScreen.css';

interface MessageScreenProps {
  title: string;
  body: string;
  action: ReactNode;
}

/**
 * The layout both dead ends share: a wrong address, and a render that failed.
 * One component so the two cannot drift into looking like different products.
 */
export default function MessageScreen({ title, body, action }: MessageScreenProps) {
  return (
    <main className="page message">
      <h1 className="message__title">{title}</h1>
      <p className="message__body">{body}</p>
      <div className="message__action">{action}</div>
    </main>
  );
}
