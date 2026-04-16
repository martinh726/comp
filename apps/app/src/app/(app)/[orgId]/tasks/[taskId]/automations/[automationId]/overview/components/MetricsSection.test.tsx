import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsSection } from './MetricsSection';

describe('MetricsSection (CS-97)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('labels the schedule as 9:00 AM UTC (no ambiguous local time)', () => {
    vi.setSystemTime(new Date('2026-04-16T07:00:00Z'));
    render(<MetricsSection initialVersions={[]} initialRuns={[]} />);
    expect(screen.getByText('Every day at 9:00 AM UTC')).toBeInTheDocument();
  });

  it('renders the next run as a concrete weekday + time rather than the old hardcoded "Tomorrow 9:00 AM"', () => {
    vi.setSystemTime(new Date('2026-04-16T07:00:00Z'));
    render(<MetricsSection initialVersions={[]} initialRuns={[]} />);

    // The old hardcoded literals must be gone.
    expect(screen.queryByText('Every Day 9:00 AM')).not.toBeInTheDocument();
    expect(screen.queryByText('Tomorrow 9:00 AM')).not.toBeInTheDocument();

    // The next-run line should be a real locale string formatted as
    // "Weekday H:MM AM/PM", which is NOT the word "Tomorrow".
    const nextRunLabels = screen.getAllByText(/\d{1,2}:\d{2}\s(AM|PM)$/);
    expect(nextRunLabels.length).toBeGreaterThan(0);
  });

  it('picks today (UTC) when the current time is before 09:00 UTC', () => {
    // 2026-04-16 07:00 UTC → next run is 2026-04-16 09:00 UTC (same day).
    vi.setSystemTime(new Date('2026-04-16T07:00:00Z'));
    render(<MetricsSection initialVersions={[]} initialRuns={[]} />);

    const expected = new Date('2026-04-16T09:00:00Z').toLocaleString(
      undefined,
      {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      },
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('picks the next day (UTC) when the current time is past 09:00 UTC', () => {
    // 2026-04-16 10:00 UTC → today's run already happened, next is 2026-04-17 09:00 UTC.
    vi.setSystemTime(new Date('2026-04-16T10:00:00Z'));
    render(<MetricsSection initialVersions={[]} initialRuns={[]} />);

    const expected = new Date('2026-04-17T09:00:00Z').toLocaleString(
      undefined,
      {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      },
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
