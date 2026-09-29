import { useEffect } from 'react';

/**
 * What the board takes over from the document while it is on screen.
 *
 * The scroll, because the board fills the window and pans itself, and a page
 * that scrolls as well fights it. And the theme: the board is a dark room with
 * lit cards in it, and its masthead carries no theme toggle, so a reader whose
 * system is set to light would get a white board with no way to change it.
 *
 * Both are undone on the way out, so the flight page keeps its scrollbar and
 * whichever theme the reader actually chose. Giving back nothing is part of
 * that: writing a theme where there was none would strip the system setting
 * from someone who never chose one.
 */
export function useBoardChrome() {
  useEffect(() => {
    const html = document.documentElement;
    const chosen = html.getAttribute('data-theme');

    document.body.classList.add('is-board');
    html.setAttribute('data-theme', 'dark');

    return () => {
      document.body.classList.remove('is-board');
      if (chosen === null) html.removeAttribute('data-theme');
      else html.setAttribute('data-theme', chosen);
    };
  }, []);
}
