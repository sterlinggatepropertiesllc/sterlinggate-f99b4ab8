import { describe, expect, it } from 'vitest';
import { formatDisplayDate, parseDisplayDate } from './dateUtils';

describe('dateUtils', () => {
  it('keeps date-only Supabase values on the intended calendar day', () => {
    expect(formatDisplayDate('2026-04-30')).toBe('Apr 30, 2026');
    expect(formatDisplayDate('2026-04-05')).toBe('Apr 5, 2026');
  });

  it('returns null for empty or invalid dates', () => {
    expect(parseDisplayDate(null)).toBeNull();
    expect(parseDisplayDate('not-a-date')).toBeNull();
  });
});
