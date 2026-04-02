# Google Sheets sync without a service account key

Your org blocks **service account key** creation (`iam.disableServiceAccountKeyCreation`). Use **one** of these instead.

## Option A — API key (simplest; sheets must be link-readable)

Works when each spreadsheet is shared as **Anyone with the link → Viewer** (or the file is public).

1. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials** → **Create credentials** → **API key**.
2. **Restrict key**: Application restrictions as you prefer; **API restrictions** → limit to **Google Sheets API**.
3. Enable **Google Sheets API** for the project (**APIs & Services** → **Library**).
4. In each Google Sheet: **Share** → **General access** → **Anyone with the link** → **Viewer**.

Set on the server:

```bash
GOOGLE_SHEETS_API_KEY=your_api_key_here
```

After editing `backend/.env`, **restart the API** (`Ctrl+C`, then `npm run dev`). On startup you should see `[Sheets] OAuth configured`. If the refresh token contains `=`, wrap it in double quotes: `GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN="1//..."`.

Do **not** commit the key. Remove `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` if you were trying to use a service account.

---

## Option B — OAuth2 refresh token (private sheets; no JSON key)

Uses a normal **OAuth client ID** (Desktop or Web) plus a **refresh token**. No service account key file.

### 1. Create OAuth client

1. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
2. If prompted, configure the **OAuth consent screen** (Internal or External; add scope `.../auth/spreadsheets.readonly` or full spreadsheets readonly).
3. Application type: **Desktop app** (easiest) or **Web application** (add redirect URI `https://developers.google.com/oauthplayground` if you use the Playground below).

### 2. Get a refresh token (OAuth 2.0 Playground)

1. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Gear icon → **Use your own OAuth credentials** → paste **Client ID** and **Client secret** from step 1.
3. In the left list, find **Sheets API v4** → select  
   `https://www.googleapis.com/auth/spreadsheets.readonly`  
   (or `.../auth/spreadsheets` if you need broader access).
4. **Authorize APIs** → sign in with the Google account that **can open both spreadsheets**.
5. **Exchange authorization code for tokens** → copy the **Refresh token**.

### 3. Environment variables

```bash
GOOGLE_SHEETS_OAUTH_CLIENT_ID=...
GOOGLE_SHEETS_OAUTH_CLIENT_SECRET=...
GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN=...
```

UnSet `GOOGLE_SHEETS_API_KEY` if you use OAuth. Sheets remain private; the signed-in user must have access.

---

## Which to choose?

| Method        | Private sheets | Org policy friendly   |
|---------------|----------------|------------------------|
| API key       | No*            | Usually yes            |
| OAuth refresh | Yes            | Usually yes            |
| Service acc.  | Yes            | Often blocked (keys) |

\*Unless you use a different sharing model that still allows API-key access (rare for private data).
