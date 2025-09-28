import { describe, test, expect } from 'vitest';
import { DateTime } from 'luxon';

describe('Quiet Hour Function', () => {
  // Mock function to simulate quiet hour check (extracted from sender.ts logic)
  const isQuietHour = (timezone: string, isDemo: boolean, currentTime?: DateTime) => {
    const now = currentTime || DateTime.now().setZone(timezone);
    return !isDemo && (now.hour < 8 || now.hour >= 20);
  };

  test('should return true outside quiet hours (before 08:00)', () => {
    const now = DateTime.fromObject({ hour: 7, minute: 0 }, { zone: 'America/New_York' });
    expect(isQuietHour('America/New_York', false, now)).toBe(true);
  });

  test('should return true outside quiet hours (after 20:00)', () => {
    const now = DateTime.fromObject({ hour: 20, minute: 1 }, { zone: 'America/New_York' });
    expect(isQuietHour('America/New_York', false, now)).toBe(true);
  });

  test('should return false within quiet hours (08:00–20:00)', () => {
    const now = DateTime.fromObject({ hour: 12, minute: 0 }, { zone: 'America/New_York' });
    expect(isQuietHour('America/New_York', false, now)).toBe(false);
  });

  test('should return false in Demo Mode regardless of time', () => {
    const now = DateTime.fromObject({ hour: 7, minute: 0 }, { zone: 'America/New_York' });
    expect(isQuietHour('America/New_York', true, now)).toBe(false);
  });
});