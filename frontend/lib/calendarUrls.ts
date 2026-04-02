/** Public embed URL for sales@margav.energy (Calendar → Integrate calendar). */
export const DEFAULT_GOOGLE_CALENDAR_EMBED_URL =
  'https://calendar.google.com/calendar/embed?src=sales%40margav.energy&ctz=Europe%2FLondon';

const DEFAULT_CALENDAR_ID = 'sales@margav.energy';

/**
 * Base64url of the calendar ID (email), used by Google Calendar’s full web app `cid=` param.
 */
function encodeCalendarCid(calendarId: string): string {
  try {
    const binary = btoa(calendarId);
    return binary.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  } catch {
    return '';
  }
}

/** Read-only iframe (Integrate calendar). Override with `VITE_GOOGLE_CALENDAR_EMBED_URL`. */
export function getGoogleCalendarEmbedUrl(): string {
  const fromEnv = (import.meta.env.VITE_GOOGLE_CALENDAR_EMBED_URL as string | undefined)?.trim();
  return fromEnv || DEFAULT_GOOGLE_CALENDAR_EMBED_URL;
}

/**
 * Full Google Calendar web app (week view) for this calendar — **Create** and edit work here.
 * Google’s embedded iframe does not offer the same UI; clicks often open the full site.
 *
 * Override with `VITE_GOOGLE_CALENDAR_WEB_URL` (paste from browser when viewing that calendar).
 * Or set `VITE_GOOGLE_CALENDAR_ID` if the email/id differs from the default.
 */
export function getGoogleCalendarWebAppUrl(): string {
  const fromEnv = (import.meta.env.VITE_GOOGLE_CALENDAR_WEB_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  const calId =
    (import.meta.env.VITE_GOOGLE_CALENDAR_ID as string | undefined)?.trim() || DEFAULT_CALENDAR_ID;
  const cid = encodeCalendarCid(calId);
  if (!cid) {
    return 'https://calendar.google.com/calendar/u/0/r/week';
  }
  return `https://calendar.google.com/calendar/u/0/r/week?cid=${encodeURIComponent(cid)}`;
}
