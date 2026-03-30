/**
 * SMS Provider abstraction - Twilio integration.
 * Stub when TWILIO_* env vars are not set.
 */

import twilio from 'twilio';
import { config } from '../config';

export interface SendSmsResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  /** Text actually sent (after SMS_MAX_CHARS truncation) */
  sentBody?: string;
}

/** Twilio trial: single GSM segment ~160 chars; multi-segment is blocked. */
export function clampSmsBody(body: string, max: number): string {
  if (max <= 0 || body.length <= max) return body;
  const trimmed = body.replace(/\r\n/g, '\n').trim();
  const urlMatch = trimmed.match(/(https?:\/\/[^\s]+)$/);
  if (urlMatch) {
    const url = urlMatch[1];
    const prefix = trimmed.slice(0, trimmed.length - url.length).replace(/\s+$/u, '');
    const space = ' ';
    const budget = max - url.length - space.length;
    if (budget < 12) return url.slice(0, max);
    const short =
      prefix.length > budget ? `${prefix.slice(0, Math.max(0, budget - 3)).trim()}...` : prefix;
    const out = `${short}${space}${url}`.trim();
    return out.length > max ? out.slice(0, max) : out;
  }
  return trimmed.slice(0, max - 3) + '...';
}

/** Normalize phone to E.164 for Twilio (digits only, ensure + prefix) */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    return '+44' + digits.slice(1); // Assume UK if starts with 0
  }
  if (digits.length === 10 && !phone.startsWith('+')) {
    return '+44' + digits; // UK 10-digit
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits; // US
  }
  return phone.startsWith('+') ? phone : '+' + digits;
}

/**
 * Send an SMS via Twilio (when configured) or stub.
 * Applies SMS_MAX_CHARS (default 160) so Twilio trial single-segment rules are satisfied.
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const max = config.smsMaxChars;
  const sentBody = clampSmsBody(body, max);
  if (sentBody !== body && max > 0) {
    console.log(
      `[SMS] Truncated message ${body.length}→${sentBody.length} chars (SMS_MAX_CHARS=${max}, Twilio trial = 1 segment)`
    );
  }

  if (!config.twilio.accountSid || !config.twilio.authToken || !config.twilio.phoneNumber) {
    const stubId = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    console.log(`[SMS Stub] Would send to ${to}: ${sentBody.slice(0, 50)}... (id: ${stubId})`);
    return { success: true, providerMessageId: stubId, sentBody };
  }

  try {
    const client = twilio(config.twilio.accountSid, config.twilio.authToken);
    const from = config.twilio.alphanumericSenderId || config.twilio.phoneNumber;
    const toE164 = normalizePhone(to);
    const message = await client.messages.create({
      body: sentBody,
      from,
      to: toE164,
    });
    console.log(`[SMS] Twilio accepted → to ${toE164} sid=${message.sid} status=${message.status}`);
    return { success: true, providerMessageId: message.sid, sentBody };
  } catch (err: unknown) {
    const twilioErr = err as { message?: string; code?: number; status?: number };
    const error = err instanceof Error ? err.message : String(err);
    console.error(
      '[SMS] Twilio send failed:',
      error,
      twilioErr.code != null ? `(Twilio code ${twilioErr.code})` : ''
    );
    if (twilioErr.code === 21211 || twilioErr.code === 21614) {
      console.error(
        '[SMS] Trial accounts must send only to Verified Caller IDs (Twilio Console → Phone Numbers → Verified).'
      );
    }
    return { success: false, error, sentBody };
  }
}
