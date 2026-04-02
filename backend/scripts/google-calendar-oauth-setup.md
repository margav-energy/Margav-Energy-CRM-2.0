# Google Calendar API — appointment sync

Appointments created in the CRM can create/update/delete events on a shared calendar (default `sales@margav.energy`). Auth reuses the same **OAuth client** or **service account** pattern as Google Sheets, but the token must include **Calendar** scopes.

## 1. Enable the API

In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Library** → enable **Google Calendar API** for the same project as Sheets/OAuth.

## 2. OAuth refresh token (recommended with existing OAuth client)

If you already use `GOOGLE_SHEETS_OAUTH_*` for Sheets, the refresh token may only include Sheets scopes. **Re-authorize** so the token includes Calendar:

1. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Gear icon → **Use your own OAuth credentials** → Client ID and Client secret from GCP.
3. In the scope list, add **Google Calendar API v3** →  
   `https://www.googleapis.com/auth/calendar.events`  
   (or `https://www.googleapis.com/auth/calendar` for full calendar access).
4. **Authorize APIs** → sign in → **Exchange authorization code for tokens**.
5. Copy the **Refresh token** into env (see below).

Optional: set a dedicated variable so Sheets-only tokens stay unchanged:

```bash
GOOGLE_CALENDAR_OAUTH_REFRESH_TOKEN=...
```

If unset, the app falls back to `GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN` / `GOOGLE_OAUTH_REFRESH_TOKEN`.

### Target calendar

- **`GOOGLE_CALENDAR_ID`** — calendar id. Default is `sales@margav.energy`.  
  For the OAuth **user’s** primary calendar, use `primary`.
- The signed-in user (OAuth) or the service account must have **permission to create events** on that calendar (share the calendar with the user email, or for a workspace resource calendar, grant the user “Make changes to events” as appropriate).

## 3. Service account (no user OAuth)

If you use `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` (or `_B64`), the same JSON can be used for Calendar **if** the service account email is granted access to the target calendar:

1. In Google Calendar (as an admin or calendar owner): **Settings** for `sales@margav.energy` (or the shared calendar) → **Share with specific people** → add the service account client email (e.g. `something@project.iam.gserviceaccount.com`) with **Make changes to events**.
2. Ensure the Calendar API is enabled (step 1).

## 4. Environment toggles

```bash
# Default: enabled unless set to false or 0
# GOOGLE_CALENDAR_ENABLED=true

# GOOGLE_CALENDAR_ID=sales@margav.energy
# GOOGLE_CALENDAR_TIMEZONE=Europe/London
# GOOGLE_CALENDAR_DEFAULT_DURATION_MINUTES=60
```

After changing `.env`, restart the API server.

## 5. Troubleshooting

- **No events appear** — Confirm Calendar API enabled, refresh token includes `calendar.events` (or `calendar`), and `GOOGLE_CALENDAR_ID` matches a calendar the identity can edit.
- **403 / insufficient permissions** — Share the calendar with the OAuth user or service account; domain-wide delegation is only needed for special Workspace setups.
- **Prisma column** — Run migrations so `Appointment.googleCalendarEventId` exists (`npx prisma migrate deploy`).
