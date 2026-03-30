/**
 * SMS Provider abstraction - prepared for Twilio integration.
 * Implement SmsProvider interface with Twilio client when ready.
 */

export interface SendSmsOptions {
  to: string;
  body: string;
  from?: string;
}

export interface SmsProvider {
  send(options: SendSmsOptions): Promise<{ messageId: string; status: string }>;
  validateWebhook(payload: unknown, signature: string): boolean;
}
