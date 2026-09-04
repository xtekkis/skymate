import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HeroScroll from './HeroScroll';

/** jsdom answers no media query, so a test that wants motion has to say so. */
function allowMotion(allowed: boolean) {
  window.matchMedia = ((query: string) =>
    ({
      // Matched on no-preference only. Testing for 'reduce' would be wrong:
      // the string "prefers-reduced-motion: no-preference" contains it too,
      // so both queries would report the same answer.
      matches: allowed === query.includes('no-preference'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  document.getElementById('main')?.remove();
});

const video = () => document.querySelector('video');
const stage = () => document.querySelector('.hero__stage') as HTMLElement;

function withMain() {
  const main = document.createElement('main');
  main.id = 'main';
  main.scrollIntoView = vi.fn();
  document.body.appendChild(main);
  return main;
}

describe('the footage', () => {
  it('plays itself, silently, without taking over the screen', () => {
    allowMotion(true);
    render(<HeroScroll />);

    const element = video();
    expect(element).toBeTruthy();

    // muted is not a preference here. Autoplay is only permitted for muted
    // video, so without it the hero is a still frame on every browser.
    expect(element?.muted ?? element?.hasAttribute('muted')).toBeTruthy();
    expect(element?.hasAttribute('loop')).toBe(true);
    // Without playsInline, iOS takes the video fullscreen on play.
    expect(element?.hasAttribute('playsinline')).toBe(true);
  });

  it('shows a still immediately, before a megabyte has arrived', () => {
    allowMotion(true);
    render(<HeroScroll />);

    // On a free tier that sleeps, the first paint matters more than usual.
    expect(video()?.getAttribute('poster')).toBe('/hero-poster.jpg');
  });

  it('is decoration, and says so', () => {
    allowMotion(true);
    render(<HeroScroll />);

    expect(video()?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByLabelText('Introduction')).toBeTruthy();
  });
});

describe('when motion is unwelcome', () => {
  it('serves the still and never asks for the video at all', () => {
    allowMotion(false);
    render(<HeroScroll />);

    // Not a paused video: not requested. A loop that plays forever is motion,
    // and the honest answer to the preference is to skip the download.
    expect(video()).toBeNull();

    const still = document.querySelector('img.hero__media');
    expect(still?.getAttribute('src')).toBe('/hero-poster.jpg');
    // Decorative, so an empty alt rather than a description of the sky.
    expect(still?.getAttribute('alt')).toBe('');
  });

  it('leaves every layer exactly as the stylesheet drew it', () => {
    allowMotion(false);
    render(<HeroScroll />);

    for (const layer of Array.from(stage().children) as HTMLElement[]) {
      expect(layer.style.transform).toBe('');
      expect(layer.style.opacity).toBe('');
    }
  });
});

describe('the composition', () => {
  it('says something worth reading, not just moving', () => {
    allowMotion(true);
    render(<HeroScroll />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'Every departure board',
    );
  });

  it('darkens the footage under the words and breaks it up with grain', () => {
    allowMotion(true);
    render(<HeroScroll />);

    // Without the scrim the type sits on bright sky and is unreadable; without
    // the grain a flat sky bands once the bitrate is cut this far.
    expect(document.querySelector('.hero__scrim')).toBeTruthy();
    expect(document.querySelector('.hero__grain')).toBeTruthy();
  });

  it('keeps the type above the footage in the stack', () => {
    allowMotion(true);
    render(<HeroScroll />);

    const order = Array.from(stage().children).map((el) => (el.getAttribute('class') ?? '').split(' ')[0]);

    expect(order.indexOf('hero__copy')).toBeGreaterThan(order.indexOf('hero__media'));
  });
});

describe('skipping it', () => {
  it('takes you to the page rather than making you scroll past', async () => {
    allowMotion(true);
    const main = withMain();

    const user = userEvent.setup();
    render(<HeroScroll />);
    await user.click(screen.getByRole('button', { name: 'Skip intro' }));

    expect(main.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('does not smooth-scroll someone who asked for no motion', async () => {
    allowMotion(false);
    const main = withMain();

    const user = userEvent.setup();
    render(<HeroScroll />);
    await user.click(screen.getByRole('button', { name: 'Skip intro' }));

    // A smooth scroll is motion too, and this is the one place it would be
    // easy to forget that.
    expect(main.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });
});
