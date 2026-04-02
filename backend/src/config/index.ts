import path from 'path';
import dotenv from 'dotenv';

// Default dotenv only reads process.cwd()/.env — if your shell cwd is wrong, OAuth vars
// never load. Always load backend/.env from this file's location (works for src/ and dist/).
const backendEnvRoot = path.join(__dirname, '../../.env');
dotenv.config();
dotenv.config({ path: backendEnvRoot, override: true });

if (!process.env.DATABASE_URL) {
  console.warn('Warning: DATABASE_URL is not set. Database operations will fail.');
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL!,
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000', 'http://localhost:5173'],
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    // Alphanumeric sender ID (e.g. "MarGav Solar") - max 11 chars. UK supported.
    // WARNING: One-way only - recipients cannot reply. Breaks BOOK/QUALIFIER/STOP flow.
    alphanumericSenderId: process.env.TWILIO_ALPHANUMERIC_SENDER_ID?.trim() || null,
  },
  // SMS Lead Journey - business hours (UTC)
  businessHours: {
    startHour: parseInt(process.env.BUSINESS_HOURS_START ?? '9', 10),   // 9am
    endHour: parseInt(process.env.BUSINESS_HOURS_END ?? '18', 10),       // 6pm
    timezone: process.env.BUSINESS_HOURS_TZ ?? 'Europe/London',
    // Weekend: 0=Sun, 6=Sat. Empty = weekdays only.
    weekendDays: (process.env.BUSINESS_HOURS_WEEKEND ?? '0,6').split(',').map(Number),
  },
  // Default qualifier for callback tasks (cuid). If not set, first QUALIFIER user is used.
  defaultQualifierId: process.env.DEFAULT_QUALIFIER_ID,
  // Qualifier phone number - receives lead details when customer replies QUALIFIER
  qualifierPhoneNumber: process.env.QUALIFIER_PHONE_NUMBER?.trim() || null,
  // Qualifier callback delay (office hours): minutes until qualifier should call
  qualifierCallbackMinutes: parseInt(process.env.QUALIFIER_CALLBACK_MINUTES ?? '15', 10),
  // Lead import API key for Google Sheets / external integrations (optional)
  leadImportApiKey: process.env.LEAD_IMPORT_API_KEY?.trim() || undefined,
  // No-obligation survey link sent when customer books appointment via SMS
  surveyLink: process.env.SURVEY_LINK || '',
  // Website link for SMS signatures
  websiteLink: process.env.WEBSITE_LINK || '',
  // Landing page / qualification form link (out-of-hours initial SMS)
  landingPageLink: process.env.LANDING_PAGE_LINK || process.env.SURVEY_LINK || '',
  /**
   * Max characters per SMS before truncation (GSM ~160 = 1 segment). Twilio **trial** blocks multi-segment.
   * Set `SMS_MAX_CHARS=0` to disable (paid accounts, longer messages).
   */
  smsMaxChars: (() => {
    const raw = process.env.SMS_MAX_CHARS;
    if (raw === undefined || raw === '') return 160;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return 160;
    return n;
  })(),
  /**
   * When true: task delays use **seconds** instead of minutes (e.g. QUALIFIER_CALLBACK_MINUTES=15 → 15s).
   * Cron-style windows (next-day follow-up, appt reminders) use short test windows — see SMS_JOURNEY_TEST_* envs.
   */
  smsJourneyTestMode:
    process.env.SMS_JOURNEY_TEST_MODE === 'true' || process.env.SMS_JOURNEY_TEST_MODE === '1',
  /** Test: "next office hours" callback delay (seconds) — replaces multi-hour waits */
  smsJourneyTestDeferredCallbackSec: parseInt(process.env.SMS_JOURNEY_TEST_DEFER_CALLBACK_SEC ?? '45', 10),
  /** Test: NO_CONTACT 2h/4h follow-up task due time (seconds) */
  smsJourneyTestNoContactDelaySec: parseInt(process.env.SMS_JOURNEY_TEST_NO_CONTACT_DELAY_SEC ?? '30', 10),
  /** Test: process-no-replies looks back this many seconds (not hours) */
  smsJourneyTestNoReplySec: parseInt(process.env.SMS_JOURNEY_TEST_NO_REPLY_SEC ?? '60', 10),
  /** Test: next-day SMS #4 — thread must be older than this many seconds */
  smsJourneyTestChaseFollowupSec: parseInt(process.env.SMS_JOURNEY_TEST_CHASE_FOLLOWUP_SEC ?? '90', 10),
  /** Test: SMS #7 — appointments scheduled within next N seconds */
  smsJourneyTestApptReminderWindowSec: parseInt(process.env.SMS_JOURNEY_TEST_APPT_REMINDER_WINDOW_SEC ?? '180', 10),
  /** Test: SMS #8 — appointments with scheduledAt between now+1s and now+N s (book within this window to test) */
  smsJourneyTestSurveyorWindowSec: parseInt(process.env.SMS_JOURNEY_TEST_SURVEYOR_WINDOW_SEC ?? '120', 10),
  /** Comma-separated qualifier usernames (lowercase) for Rattle/Leadwise sheet sync + dashboard */
  specialSheetsQualifierUsernames: (process.env.SPECIAL_SHEETS_QUALIFIER_USERNAMES ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  /** Legacy: also match by email if set */
  specialSheetsQualifierEmails: (process.env.SPECIAL_SHEETS_QUALIFIER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  googleSheets: {
    /** Public sheets only: create an API key (APIs & Services → Credentials), restrict to Sheets API */
    apiKey: process.env.GOOGLE_SHEETS_API_KEY?.trim() || undefined,
    /** OAuth2 — also accepts GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN */
    oauthClientId:
      process.env.GOOGLE_SHEETS_OAUTH_CLIENT_ID?.trim() ||
      process.env.GOOGLE_CLIENT_ID?.trim() ||
      undefined,
    oauthClientSecret:
      process.env.GOOGLE_SHEETS_OAUTH_CLIENT_SECRET?.trim() ||
      process.env.GOOGLE_CLIENT_SECRET?.trim() ||
      undefined,
    oauthRefreshToken:
      process.env.GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN?.trim() ||
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() ||
      undefined,
    serviceAccountJson: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON,
    serviceAccountJsonB64: process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_B64,
    rattleSpreadsheetId:
      process.env.RATTLE_SPREADSHEET_ID || '1jcEQJHnDXFoHpseVVYpt4kDaB_iK5ChbkWImJS7V7gQ',
    rattleSheetName: process.env.RATTLE_SHEET_NAME || 'Ver2',
    leadwiseSpreadsheetId:
      process.env.LEADWISE_SPREADSHEET_ID || '1wcrqQkOEXJmObaT5soi3X009LcGIBlrz4-5ToyF9Pek',
    leadwiseSheetName: process.env.LEADWISE_SHEET_NAME || 'Leads',
  },
  /** Google Calendar API — appointment sync (same OAuth/SA as Sheets; OAuth token needs Calendar scope). */
  googleCalendar: {
    enabled: process.env.GOOGLE_CALENDAR_ENABLED !== 'false' && process.env.GOOGLE_CALENDAR_ENABLED !== '0',
    /** Target calendar: usually `sales@margav.energy` or `primary` for the OAuth user */
    calendarId: (process.env.GOOGLE_CALENDAR_ID || 'sales@margav.energy').trim(),
    timezone: process.env.GOOGLE_CALENDAR_TIMEZONE || 'Europe/London',
    /** Default survey / visit block length */
    defaultDurationMinutes: parseInt(process.env.GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES || '60', 10),
    /**
     * Optional: refresh token that includes `calendar.events` scope.
     * If unset, falls back to GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN / GOOGLE_OAUTH_REFRESH_TOKEN
     * (must re-authorize in OAuth Playground with Calendar scope — see scripts/google-calendar-oauth-setup.md).
     */
    oauthRefreshToken:
      process.env.GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN?.trim() ||
      process.env.GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN?.trim() ||
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim() ||
      undefined,
  },
};
