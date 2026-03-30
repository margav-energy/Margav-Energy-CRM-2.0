import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { sendError } from '../utils/apiResponse';

/** Read API key from x-api-key or Authorization: Bearer (Postman / some clients). */
function extractImportApiKey(req: Request): string | undefined {
  const fromHeader = (req.headers['x-api-key'] as string | undefined)?.trim();
  if (fromHeader) return fromHeader;

  const auth = (req.headers.authorization as string | undefined)?.trim();
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return undefined;
}

/**
 * API key auth for lead import (Google Sheets, webhooks, etc.).
 * Requires `x-api-key` header OR `Authorization: Bearer <key>` matching LEAD_IMPORT_API_KEY.
 * If LEAD_IMPORT_API_KEY is not set, rejects all requests.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = extractImportApiKey(req);
  const expected = config.leadImportApiKey?.trim();

  if (!expected) {
    sendError(res, 'Lead import is not configured. Set LEAD_IMPORT_API_KEY.', 503);
    return;
  }

  if (!apiKey || apiKey !== expected) {
    sendError(res, 'Invalid or missing API key', 401);
    return;
  }

  next();
}
