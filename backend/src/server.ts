import app from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
  console.log(`Margav CRM API running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  const twilioReady =
    Boolean(config.twilio.accountSid && config.twilio.authToken && config.twilio.phoneNumber);
  console.log(
    twilioReady
      ? `[SMS] Twilio configured (from: ${config.twilio.alphanumericSenderId || config.twilio.phoneNumber})`
      : '[SMS] Twilio NOT fully configured — SMS are stubbed (logged only, no real texts). Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env'
  );
  console.log(
    config.leadImportApiKey
      ? '[API] Lead import enabled (POST /api/leads/import with x-api-key)'
      : '[API] Lead import disabled — set LEAD_IMPORT_API_KEY in .env'
  );
  if (config.smsJourneyTestMode) {
    console.log(
      '[SMS Journey] TEST MODE: task delays use seconds (not minutes); see SMS_JOURNEY_TEST_* in .env'
    );
  }
});

export default server;
