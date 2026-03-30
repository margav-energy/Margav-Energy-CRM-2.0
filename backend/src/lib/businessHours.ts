/**
 * Business hours helper for SMS lead journey.
 * Determines if we're in office hours (qualifier callback) vs outside hours (qualifying questions).
 */

import { config } from '../config';

/**
 * Get current hour and day of week in the configured business timezone.
 */
function getLocalTime(date: Date = new Date()): { hour: number; dayOfWeek: number } {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.businessHours.timezone,
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = dayMap[weekday] ?? 1;
  return { hour, dayOfWeek };
}

/**
 * Check if the given date (or now) falls within office hours.
 * Office hours: weekdays (excluding weekendDays), between startHour and endHour.
 */
export function isWithinOfficeHours(date: Date = new Date()): boolean {
  const { hour, dayOfWeek } = getLocalTime(date);
  const { startHour, endHour, weekendDays } = config.businessHours;

  if (weekendDays.includes(dayOfWeek)) {
    return false;
  }
  return hour >= startHour && hour < endHour;
}

/**
 * Get the next office hours start (for scheduling chase/callback tasks).
 * Returns a Date at the start of the next office period in the configured timezone.
 */
export function getNextOfficeHoursStart(from: Date = new Date()): Date {
  const { startHour, weekendDays } = config.businessHours;
  const { hour, dayOfWeek } = getLocalTime(from);

  // If within office hours now, "next" = tomorrow's start
  let daysToAdd = hour >= config.businessHours.endHour || weekendDays.includes(dayOfWeek) ? 1 : 0;
  if (weekendDays.includes(dayOfWeek)) {
    daysToAdd = 1;
  }

  const result = new Date(from);
  result.setDate(result.getDate() + daysToAdd);
  // Skip weekend days
  while (weekendDays.includes(getLocalTime(result).dayOfWeek)) {
    result.setDate(result.getDate() + 1);
  }
  result.setHours(startHour, 0, 0, 0);
  return result;
}

/**
 * Get the next calendar day's office hours start (for NO_CONTACT "next day" follow-up).
 */
export function getNextDayOfficeHoursStart(from: Date = new Date()): Date {
  const { startHour, weekendDays } = config.businessHours;
  const result = new Date(from);
  result.setDate(result.getDate() + 1);
  while (weekendDays.includes(getLocalTime(result).dayOfWeek)) {
    result.setDate(result.getDate() + 1);
  }
  result.setHours(startHour, 0, 0, 0);
  return result;
}

/**
 * Get office hours start N days from now (for re-route in 14 days).
 */
export function getOfficeHoursStartInDays(days: number, from: Date = new Date()): Date {
  const { startHour, weekendDays } = config.businessHours;
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  while (weekendDays.includes(getLocalTime(result).dayOfWeek)) {
    result.setDate(result.getDate() + 1);
  }
  result.setHours(startHour, 0, 0, 0);
  return result;
}
