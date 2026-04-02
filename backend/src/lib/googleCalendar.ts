import { google } from 'googleapis';
import { JWT, OAuth2Client } from 'google-auth-library';
import { config } from '../config';

function parseServiceAccountJson(raw: string): { clientEmail: string; privateKey: string } {
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
  } catch {
    throw new Error('GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  const clientEmail = parsed.client_email;
  let privateKey = parsed.private_key;
  if (!clientEmail || !privateKey) {
    throw new Error('Service account JSON must include client_email and private_key');
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
  return { clientEmail, privateKey };
}

/**
 * OAuth (refresh token with Calendar scope) or service account (calendar shared with SA email).
 * API keys cannot create calendar events.
 */
export function getCalendarAuth(): OAuth2Client | JWT | null {
  const gc = config.googleCalendar;
  const gs = config.googleSheets;
  if (!gc.enabled) return null;

  const refreshToken = gc.oauthRefreshToken;
  if (gs.oauthClientId && gs.oauthClientSecret && refreshToken) {
    const oauth2 = new OAuth2Client(gs.oauthClientId, gs.oauthClientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  let raw = gs.serviceAccountJson;
  if (!raw && gs.serviceAccountJsonB64) {
    raw = Buffer.from(gs.serviceAccountJsonB64, 'base64').toString('utf8');
  }
  if (raw) {
    const { clientEmail, privateKey } = parseServiceAccountJson(raw);
    return new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  }

  return null;
}

export function isGoogleCalendarWriteConfigured(): boolean {
  return getCalendarAuth() !== null;
}

function buildEventBody(params: {
  scheduledAt: Date;
  durationMinutes: number;
  summary: string;
  descriptionLines: string[];
}): {
  summary: string;
  description: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
} {
  const tz = config.googleCalendar.timezone;
  const end = new Date(params.scheduledAt.getTime() + params.durationMinutes * 60 * 1000);
  return {
    summary: params.summary,
    description: params.descriptionLines.filter(Boolean).join('\n'),
    start: { dateTime: params.scheduledAt.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
  };
}

/** Create an event on the configured calendar. Returns event id or null if not configured / error. */
export async function insertAppointmentCalendarEvent(params: {
  scheduledAt: Date;
  leadFirstName: string;
  leadLastName: string;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  postcode?: string | null;
  fieldSalesRepName?: string | null;
  notes?: string | null;
  appointmentId: string;
}): Promise<string | null> {
  const auth = getCalendarAuth();
  if (!auth) {
    return null;
  }

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = config.googleCalendar.calendarId;
  const duration = config.googleCalendar.defaultDurationMinutes;
  const name = `${params.leadFirstName} ${params.leadLastName}`.trim() || 'Lead';
  const summary = `Survey: ${name}`;
  const lines: string[] = [
    `CRM appointment: ${params.appointmentId}`,
    params.phone ? `Phone: ${params.phone}` : '',
    params.email ? `Email: ${params.email}` : '',
    [params.addressLine1, params.city, params.postcode].filter(Boolean).join(', ')
      ? `Address: ${[params.addressLine1, params.city, params.postcode].filter(Boolean).join(', ')}`
      : '',
    params.fieldSalesRepName ? `Field rep: ${params.fieldSalesRepName}` : '',
    params.notes ? `Notes: ${params.notes}` : '',
  ];

  try {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: buildEventBody({
        scheduledAt: params.scheduledAt,
        durationMinutes: duration,
        summary,
        descriptionLines: lines,
      }),
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error('[Google Calendar] insert failed:', err);
    return null;
  }
}

export async function updateAppointmentCalendarEvent(params: {
  eventId: string;
  scheduledAt: Date;
  leadFirstName: string;
  leadLastName: string;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  postcode?: string | null;
  fieldSalesRepName?: string | null;
  notes?: string | null;
  appointmentId: string;
}): Promise<boolean> {
  const auth = getCalendarAuth();
  if (!auth) return false;

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = config.googleCalendar.calendarId;
  const duration = config.googleCalendar.defaultDurationMinutes;
  const name = `${params.leadFirstName} ${params.leadLastName}`.trim() || 'Lead';
  const summary = `Survey: ${name}`;
  const lines: string[] = [
    `CRM appointment: ${params.appointmentId}`,
    params.phone ? `Phone: ${params.phone}` : '',
    params.email ? `Email: ${params.email}` : '',
    [params.addressLine1, params.city, params.postcode].filter(Boolean).join(', ')
      ? `Address: ${[params.addressLine1, params.city, params.postcode].filter(Boolean).join(', ')}`
      : '',
    params.fieldSalesRepName ? `Field rep: ${params.fieldSalesRepName}` : '',
    params.notes ? `Notes: ${params.notes}` : '',
  ];

  try {
    await calendar.events.patch({
      calendarId,
      eventId: params.eventId,
      requestBody: buildEventBody({
        scheduledAt: params.scheduledAt,
        durationMinutes: duration,
        summary,
        descriptionLines: lines,
      }),
    });
    return true;
  } catch (err) {
    console.error('[Google Calendar] patch failed:', err);
    return false;
  }
}

export async function deleteAppointmentCalendarEvent(eventId: string): Promise<boolean> {
  const auth = getCalendarAuth();
  if (!auth) return false;

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = config.googleCalendar.calendarId;
  try {
    await calendar.events.delete({ calendarId, eventId });
    return true;
  } catch (err) {
    console.error('[Google Calendar] delete failed:', err);
    return false;
  }
}
