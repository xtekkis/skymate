import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BoardStage from './BoardStage';

const at = (h: number, m = 0) => h * 60 + m;

const ticks = () => Array.from(document.querySelectorAll('.stage__tick'));

describe('the stage', () => {
  it('names itself for anyone who cannot see it', () => {
    render(<BoardStage start={at(8)} windowHours={4} />);

    expect(screen.getByLabelText('Flight timeline')).toBeTruthy();
  });

  it('holds whatever is put on the canvas', () => {
    render(
      <BoardStage start={at(8)} windowHours={4}>
        <p>a card</p>
      </BoardStage>,
    );

    expect(screen.getByText('a card')).toBeTruthy();
  });

  it('gives the ruler and the canvas the same width', () => {
    const { container } = render(<BoardStage start={at(8)} windowHours={8} />);

    const ruler = container.querySelector<HTMLElement>('.stage__rulerInner');
    const canvas = container.querySelector<HTMLElement>('.stage__canvas');

    // They travel sideways together. Different widths and the hours drift out
    // of line with the cards they are labelling.
    expect(ruler?.style.width).toBe(canvas?.style.width);
    expect(ruler?.style.width).not.toBe('');
  });
});

describe('the ruler it draws', () => {
  it('draws a tick for every half hour in the window', () => {
    render(<BoardStage start={at(8)} windowHours={4} />);

    expect(ticks()).toHaveLength(9);
  });

  it('shows the hours and nothing on the half hours', () => {
    render(<BoardStage start={at(8)} windowHours={2} />);

    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.queryByText('08:30')).toBeNull();
  });

  it('marks the hours differently from the half hours', () => {
    render(<BoardStage start={at(8)} windowHours={2} />);

    const hours = ticks().filter((tick) => tick.className.includes('--hour'));

    // 08:00, 09:00, 10:00. The rest are the quiet ones.
    expect(hours).toHaveLength(3);
    expect(ticks()).toHaveLength(5);
  });

  it('grows with the window', () => {
    const { rerender } = render(<BoardStage start={at(8)} windowHours={4} />);
    const short = ticks().length;

    rerender(<BoardStage start={at(8)} windowHours={12} />);

    expect(ticks().length).toBeGreaterThan(short);
  });
});
