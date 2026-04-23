import { createHash } from 'crypto';
import { google } from 'googleapis';
import { JWT, OAuth2Client } from 'google-auth-library';
import { LeadStatus, Role } from '@prisma/client';
import { prisma } from '../../db';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';

export interface SheetSyncResult {
  created: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: string[];
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) {
    return '+44' + digits.slice(1);
  }
  if (digits.length === 10 && !phone.startsWith('+')) {
    return '+44' + digits;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits;
  }
  return phone.startsWith('+') ? phone : '+' + digits;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Map normalized header -> field */
function buildHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (key) map[key] = i;
  });
  return map;
}

function pick(
  row: string[],
  map: Record<string, number>,
  aliases: string[],
  fallbackCol?: number
): string {
  for (const a of aliases) {
    const idx = map[normalizeHeader(a)];
    if (idx !== undefined && row[idx] !== undefined && String(row[idx]).trim() !== '') {
      return String(row[idx]).trim();
    }
  }
  if (fallbackCol !== undefined && row[fallbackCol] !== undefined) {
    return String(row[fallbackCol]).trim();
  }
  return '';
}

export function isSpecialSheetsQualifier(user: { username: string; email: string | null }): boolean {
  const u = user.username.toLowerCase();
  if (config.specialSheetsQualifierUsernames.includes(u)) return true;
  if (user.email && config.specialSheetsQualifierEmails.includes(user.email.toLowerCase())) return true;
  return false;
}

function parseServiceAccountJson(raw: string): { clientEmail: string; privateKey: string } {
  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
  } catch {
    throw new AppError('GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON is not valid JSON', 500);
  }
  const clientEmail = parsed.client_email;
  let privateKey = parsed.private_key;
  if (!clientEmail || !privateKey) {
    throw new AppError('Service account JSON must include client_email and private_key', 500);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
  return { clientEmail, privateKey };
}

/**
 * Auth priority (no service account key required for 1–2):
 * 1) API key — spreadsheet must be readable by "Anyone with the link" (or public)
 * 2) OAuth2 refresh token — acts as your Google user; private sheets OK if that user can open them
 * 3) Service account JSON — if your org allows it
 */
function getSheetsClient() {
  const gs = config.googleSheets;

  if (gs.apiKey) {
    return google.sheets({ version: 'v4', auth: gs.apiKey });
  }

  if (gs.oauthClientId && gs.oauthClientSecret && gs.oauthRefreshToken) {
    const oauth2 = new OAuth2Client(gs.oauthClientId, gs.oauthClientSecret);
    oauth2.setCredentials({ refresh_token: gs.oauthRefreshToken });
    return google.sheets({ version: 'v4', auth: oauth2 });
  }

  let raw = gs.serviceAccountJson;
  if (!raw && gs.serviceAccountJsonB64) {
    raw = Buffer.from(gs.serviceAccountJsonB64, 'base64').toString('utf8');
  }
  if (raw) {
    const { clientEmail, privateKey } = parseServiceAccountJson(raw);
    const auth = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return google.sheets({ version: 'v4', auth });
  }

  throw new AppError(
    'Google Sheets is not configured. Use one of: (1) GOOGLE_SHEETS_API_KEY — set sheets to "Anyone with the link can view"; ' +
      '(2) OAuth: GOOGLE_SHEETS_OAUTH_CLIENT_ID, GOOGLE_SHEETS_OAUTH_CLIENT_SECRET, GOOGLE_SHEETS_OAUTH_REFRESH_TOKEN ' +
      '(see backend/scripts/google-sheets-oauth-setup.md); or (3) GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON if your org allows keys.',
    503
  );
}

interface ParsedSheetRow {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  postcode: string;
  notes: string;
  leadStatus?: LeadStatus;
  sheetCreatedAt?: Date;
  addressLine1?: string;
}

const SOURCE_ASSIGNEE: Record<'Rattle' | 'Leadwise', { username: string; fullName: string }> = {
  Rattle: { username: 'louis', fullName: 'Louis' },
  Leadwise: { username: 'ella', fullName: 'Ella' },
};

const SOURCE_QUALIFIER: Record<'Rattle' | 'Leadwise', { username: string; fullName: string }> = {
  Rattle: { username: 'louis', fullName: 'Louis' },
  Leadwise: { username: 'ella', fullName: 'Ella' },
};

async function resolveSourceAssignedAgentId(source: 'Rattle' | 'Leadwise'): Promise<string | null> {
  const target = SOURCE_ASSIGNEE[source];
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: { equals: target.username, mode: 'insensitive' } }, { fullName: target.fullName }],
      role: { in: [Role.AGENT, Role.FIELD_SALES] },
    },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function resolveSourceAssignedQualifierId(source: 'Rattle' | 'Leadwise'): Promise<string | null> {
  const target = SOURCE_QUALIFIER[source];
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: { equals: target.username, mode: 'insensitive' } }, { fullName: target.fullName }],
      role: Role.QUALIFIER,
    },
    select: { id: true },
  });
  return user?.id ?? null;
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Reject template/junk rows that are not real Leadwise lead IDs */
function isJunkLeadwiseLeadId(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (!t) return true;
  if (/new\s*order/.test(t)) return true;
  if (t === 'n/a' || t === 'na' || t === '-' || t === 'id') return true;
  return false;
}

function hasPlausiblePhoneDigits(phone: string): boolean {
  const n = digitsOnly(phone).length;
  return n >= 10 && n <= 15;
}

/**
 * One Rattle CRM row per phone number (digits only). Email in the hash caused
 * duplicates when the sheet had two rows with the same phone but different/missing
 * emails, or when legacy row-based ids coexisted with hash ids.
 */
function rattleStableOriginalId(phoneRaw: string): string {
  const d = digitsOnly(phoneRaw);
  const hash = createHash('sha256').update(`rattle|${d}`).digest('hex').slice(0, 24);
  return `rattle:${hash}`;
}

/** One Leadwise CRM row per phone (same rationale as Rattle — avoids duplicate Lead IDs / legacy ids). */
function leadwiseStableOriginalId(phoneRaw: string): string {
  const d = digitsOnly(phoneRaw);
  const hash = createHash('sha256').update(`leadwise|${d}`).digest('hex').slice(0, 24);
  return `leadwise:${hash}`;
}

/** DD/MM/YYYY [HH:mm:ss] and a few fallbacks */
function parseLeadSheetDate(s: string): Date | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
  if (m) {
    const d = new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      m[4] !== undefined ? Number(m[4]) : 0,
      m[5] !== undefined ? Number(m[5]) : 0,
      m[6] !== undefined ? Number(m[6]) : 0
    );
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? undefined : new Date(ms);
}

function mapDispositionToLeadStatus(
  disposition: string,
  outcome?: string,
  appointmentOutcome?: string
): LeadStatus | undefined {
  const d = disposition.trim().toLowerCase();
  const o = (outcome ?? '').trim().toLowerCase();
  const ao = (appointmentOutcome ?? '').trim().toLowerCase();

  // Exact / near-exact values from sheet feeds
  if (d === 'callback') return LeadStatus.QUALIFIER_CALLBACK;
  if (d === 'appointment booked') return LeadStatus.APPOINTMENT_SET;
  if (d === 'not interested') return LeadStatus.NOT_INTERESTED;
  if (d === 'dnq' || d === 'already has solar' || d === 'wrong number') return LeadStatus.NOT_QUALIFIED;
  if (d === 'no answer') return LeadStatus.NO_CONTACT;

  if (ao === 'appt not sat' || ao.includes('appt not sat') || ao.includes('no show')) {
    return LeadStatus.QUALIFIER_CALLBACK;
  }

  if (o === 'sold') return LeadStatus.SOLD;
  if (o === 'blow out' || o === 'blowout') return LeadStatus.NOT_INTERESTED;
  if (o === 'sale in progress' || o === 'high % to close') return LeadStatus.QUALIFIED;
  if (o === 'pitch & miss' || o === 'unable to dem' || o === 'no close on day') return LeadStatus.DEPOSITION;
  if (o === 'sweep') return LeadStatus.QUALIFIED;

  if (!d && !o && !ao) return undefined;
  if (d.includes('not interested')) return LeadStatus.NOT_INTERESTED;
  if (d.includes('appointment') && (d.includes('book') || d.includes('set'))) {
    return LeadStatus.APPOINTMENT_SET;
  }
  if (d.includes('sold') || d.includes('closed won') || d.includes('sale closed')) {
    return LeadStatus.SOLD;
  }
  if (d.includes('dnq') || d.includes('wrong number')) return LeadStatus.NOT_QUALIFIED;
  if (d.includes('already has solar')) return LeadStatus.NOT_QUALIFIED;
  if (d.includes('qualified') && !d.includes('not ')) return LeadStatus.QUALIFIED;
  if (d.includes('qualifying') || d.includes('sent to qualify')) return LeadStatus.QUALIFYING;
  if (d.includes('callback') || d.includes('follow up') || d.includes('follow-up')) {
    return LeadStatus.QUALIFIER_CALLBACK;
  }
  if (d.includes('no answer') || d.includes('no contact')) return LeadStatus.NO_CONTACT;
  if (d.includes('deposit')) return LeadStatus.DEPOSITION;
  if (o.includes('sold')) return LeadStatus.SOLD;
  if (o.includes('blow out') || o.includes('blowout')) return LeadStatus.NOT_INTERESTED;
  if (o.includes('sale in progress') || o.includes('high % to close')) return LeadStatus.QUALIFIED;
  if (o.includes('pitch') || o.includes('unable to dem') || o.includes('no close on day')) {
    return LeadStatus.DEPOSITION;
  }
  if (o.includes('sweep')) return LeadStatus.QUALIFIED;
  if (ao.includes('appt not sat') || ao.includes('no show')) return LeadStatus.QUALIFIER_CALLBACK;
  return undefined;
}

function joinNoteParts(parts: Array<string | undefined>): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
}

function ensureEmail(raw: string, placeholderLocal: string): string {
  if (raw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return raw.toLowerCase();
  }
  const safe = placeholderLocal.replace(/[^a-zA-Z0-9.-]/g, '');
  return `sheet.${safe || 'import'}@import.placeholder`;
}

function parseRattleRow(row: string[], headerMap: Record<string, number>): ParsedSheetRow | null {
  const firstName = pick(row, headerMap, ['first name', 'firstname', 'first', 'fname']);
  const lastName = pick(row, headerMap, ['last name', 'lastname', 'last', 'lname', 'surname']);
  const phone = pick(row, headerMap, ['phone', 'mobile', 'tel', 'telephone']);
  let email = pick(row, headerMap, ['email', 'e-mail', 'email address']);
  const postcode = pick(row, headerMap, ['postcode', 'post code', 'zip', 'zip code']);
  const dateStr = pick(row, headerMap, ['date', 'timestamp', 'created', 'time']);
  const disposition = pick(row, headerMap, ['disposition', 'status']);
  const notesBody = pick(row, headerMap, ['notes', 'note', 'comments', 'details']);
  const outcome = pick(row, headerMap, ['outcome']);
  const appointmentOutcome = pick(row, headerMap, ['appointment outcome', 'appointmentoutcome']);
  const cycles = pick(row, headerMap, ['cycles']);

  if (!phone && !email && !firstName && !lastName) {
    return null;
  }
  if (!phone) {
    return null;
  }
  if (!hasPlausiblePhoneDigits(phone)) {
    return null;
  }

  const placeholderKey = rattleStableOriginalId(phone);
  email = ensureEmail(email, placeholderKey.replace('rattle:', ''));

  const notes = joinNoteParts([
    notesBody,
    disposition ? `Disposition: ${disposition}` : '',
    outcome ? `Outcome: ${outcome}` : '',
    appointmentOutcome ? `Appointment outcome: ${appointmentOutcome}` : '',
    cycles ? `Cycles: ${cycles}` : '',
  ]);

  const leadStatus = mapDispositionToLeadStatus(disposition, outcome, appointmentOutcome);
  const sheetCreatedAt = parseLeadSheetDate(dateStr);

  return {
    firstName: firstName || 'Lead',
    lastName: lastName || 'Import',
    phone: normalizePhone(phone),
    email,
    postcode,
    notes,
    leadStatus,
    sheetCreatedAt,
  };
}

function parseLeadwiseRow(row: string[], headerMap: Record<string, number>): ParsedSheetRow | null {
  /** Canonical id is phone-based; Lead ID is kept in notes. Junk in this column still skips the row. */
  const leadIdRaw = pick(row, headerMap, ['lead id', 'leadid']);
  if (leadIdRaw && isJunkLeadwiseLeadId(leadIdRaw)) {
    return null;
  }

  const firstName = pick(row, headerMap, ['first name', 'firstname', 'first', 'fname']);
  const lastName = pick(row, headerMap, ['last name', 'lastname', 'last', 'lname', 'surname']);
  const phone = pick(row, headerMap, ['mobile', 'phone', 'tel', 'telephone']);
  let email = pick(row, headerMap, ['email', 'e-mail', 'email address']);
  const postcode = pick(row, headerMap, ['postcode', 'post code', 'zip', 'zip code']);
  const address = pick(row, headerMap, ['address', 'address line 1', 'street']);
  const timestampStr = pick(row, headerMap, ['timestamp', 'date', 'time']);
  const disposition = pick(row, headerMap, ['disposition', 'status']);
  const comments = pick(row, headerMap, ['comments', 'notes', 'note', 'details']);
  const interestedIn = pick(row, headerMap, ['interested in', 'interestedin']);
  const propertyType = pick(row, headerMap, ['property type', 'propertytype']);
  const billSpend = pick(row, headerMap, ['bill spend', 'billspend']);
  const existingSystem = pick(row, headerMap, ['existing system', 'existingsystem']);
  const paymentMethod = pick(row, headerMap, ['payment method', 'paymentmethod']);
  const homeowner = pick(row, headerMap, ['homeowner']);
  const dials = pick(row, headerMap, ['dials']);
  const appointmentOutcome = pick(row, headerMap, ['appointment outcome', 'appointmentoutcome']);

  if (!phone && !email && !firstName && !lastName) {
    return null;
  }
  if (!phone) {
    return null;
  }
  if (!hasPlausiblePhoneDigits(phone)) {
    return null;
  }

  const placeholderKey = leadwiseStableOriginalId(phone);
  email = ensureEmail(email, placeholderKey.replace('leadwise:', ''));

  const notes = joinNoteParts([
    leadIdRaw ? `Lead ID: ${leadIdRaw}` : '',
    interestedIn ? `Interested in: ${interestedIn}` : '',
    propertyType ? `Property type: ${propertyType}` : '',
    billSpend ? `Bill spend: ${billSpend}` : '',
    existingSystem ? `Existing system: ${existingSystem}` : '',
    paymentMethod ? `Payment method: ${paymentMethod}` : '',
    homeowner ? `Homeowner: ${homeowner}` : '',
    dials ? `Dials: ${dials}` : '',
    disposition ? `Disposition: ${disposition}` : '',
    appointmentOutcome ? `Appointment outcome: ${appointmentOutcome}` : '',
    comments,
  ]);

  const leadStatus = mapDispositionToLeadStatus(disposition, undefined, appointmentOutcome);
  const sheetCreatedAt = parseLeadSheetDate(timestampStr);

  return {
    firstName: firstName || 'Lead',
    lastName: lastName || 'Import',
    phone: normalizePhone(phone),
    email,
    postcode,
    notes,
    leadStatus,
    sheetCreatedAt,
    addressLine1: address || undefined,
  };
}

/** Keep oldest lead per normalized phone for a sheet source; delete extras (sheet / legacy duplicates). */
async function dedupeLeadsByPhoneForSource(source: 'Rattle' | 'Leadwise'): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: { source },
    orderBy: { createdAt: 'asc' },
    select: { id: true, phone: true },
  });
  const seenPhones = new Set<string>();
  const idsToDelete: string[] = [];
  for (const l of leads) {
    if (seenPhones.has(l.phone)) {
      idsToDelete.push(l.id);
    } else {
      seenPhones.add(l.phone);
    }
  }
  if (idsToDelete.length === 0) return 0;
  const del = await prisma.lead.deleteMany({ where: { id: { in: idsToDelete } } });
  return del.count;
}

/**
 * Sync both Rattle + Leadwise sheets into CRM leads (upsert by originalLeadId + source).
 */
export async function syncGoogleSheetsToLeads(qualifierUserId: string): Promise<SheetSyncResult> {
  const result: SheetSyncResult = { created: 0, updated: 0, skipped: 0, deleted: 0, errors: [] };

  const sheets = getSheetsClient();

  const feeds = [
    {
      spreadsheetId: config.googleSheets.rattleSpreadsheetId,
      tab: config.googleSheets.rattleSheetName,
      source: 'Rattle',
      key: 'rattle' as const,
    },
    {
      spreadsheetId: config.googleSheets.leadwiseSpreadsheetId,
      tab: config.googleSheets.leadwiseSheetName,
      source: 'Leadwise',
      key: 'leadwise' as const,
    },
  ];

  for (const feed of feeds) {
    if (!feed.spreadsheetId) {
      result.errors.push(`Missing spreadsheet id for ${feed.source}`);
      continue;
    }
    const range = `'${feed.tab.replace(/'/g, "''")}'!A1:ZZ10000`;
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: feed.spreadsheetId,
        range,
      });
      const rows = res.data.values || [];
      const seenOriginalIds = new Set<string>();

      if (rows.length < 2) {
        const del = await prisma.lead.deleteMany({
          where: {
            source: feed.source,
            originalLeadId: { not: null, startsWith: `${feed.key}:` },
          },
        });
        result.deleted += del.count;
        continue;
      }
      const headers = (rows[0] || []).map((c) => String(c ?? ''));
      const headerMap = buildHeaderMap(headers);
      const sourceAssignedAgentId = await resolveSourceAssignedAgentId(feed.source as 'Rattle' | 'Leadwise');
      const sourceAssignedQualifierId =
        (await resolveSourceAssignedQualifierId(feed.source as 'Rattle' | 'Leadwise')) ?? qualifierUserId;

      for (let i = 1; i < rows.length; i++) {
        const row = (rows[i] || []).map((c) => String(c ?? ''));
        const parsed =
          feed.key === 'rattle' ? parseRattleRow(row, headerMap) : parseLeadwiseRow(row, headerMap);
        if (!parsed) {
          result.skipped += 1;
          continue;
        }

        const originalLeadId =
          feed.key === 'rattle'
            ? rattleStableOriginalId(pick(row, headerMap, ['phone', 'mobile', 'tel', 'telephone']))
            : leadwiseStableOriginalId(pick(row, headerMap, ['mobile', 'phone', 'tel', 'telephone']));

        seenOriginalIds.add(originalLeadId);

        let existing = await prisma.lead.findFirst({
          where: { originalLeadId, source: feed.source },
        });
        if (!existing && (feed.key === 'rattle' || feed.key === 'leadwise')) {
          existing = await prisma.lead.findFirst({
            where: { source: feed.source, phone: parsed.phone },
            orderBy: { createdAt: 'asc' },
          });
        }

        const nextStatus =
          parsed.leadStatus ?? (existing ? existing.status : LeadStatus.QUALIFYING);

        if (existing) {
          const statusChanged = nextStatus !== existing.status;
          await prisma.lead.update({
            where: { id: existing.id },
            data: {
              originalLeadId,
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              phone: parsed.phone,
              email: parsed.email,
              postcode: parsed.postcode || null,
              notes: parsed.notes || existing.notes,
              addressLine1: parsed.addressLine1 ?? existing.addressLine1,
              status: nextStatus,
              assignedAgentId: sourceAssignedAgentId,
              assignedQualifierId: sourceAssignedQualifierId,
            },
          });
          if (statusChanged) {
            await prisma.leadStatusHistory.create({
              data: {
                leadId: existing.id,
                fromStatus: existing.status,
                toStatus: nextStatus,
                changedByUserId: qualifierUserId,
                note: `Google Sheet sync (${feed.source})`,
              },
            });
          }
          result.updated += 1;
        } else {
          const lead = await prisma.lead.create({
            data: {
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              phone: parsed.phone,
              email: parsed.email,
              postcode: parsed.postcode || null,
              notes: parsed.notes || null,
              addressLine1: parsed.addressLine1 ?? null,
              source: feed.source,
              originalLeadId,
              status: nextStatus,
              assignedAgentId: sourceAssignedAgentId,
              assignedQualifierId: sourceAssignedQualifierId,
              ...(parsed.sheetCreatedAt ? { createdAt: parsed.sheetCreatedAt } : {}),
            },
          });
          result.created += 1;

          await prisma.leadStatusHistory.create({
            data: {
              leadId: lead.id,
              toStatus: nextStatus,
              changedByUserId: qualifierUserId,
              note: `Imported from Google Sheet (${feed.source})`,
            },
          });
        }
      }

      if (feed.key === 'rattle' || feed.key === 'leadwise') {
        const deduped = await dedupeLeadsByPhoneForSource(feed.source as 'Rattle' | 'Leadwise');
        result.deleted += deduped;
      }

      const ids = [...seenOriginalIds];
      const del =
        ids.length === 0
          ? await prisma.lead.deleteMany({
              where: {
                source: feed.source,
                originalLeadId: { not: null, startsWith: `${feed.key}:` },
              },
            })
          : await prisma.lead.deleteMany({
              where: {
                source: feed.source,
                originalLeadId: { not: null, notIn: ids },
              },
            });
      result.deleted += del.count;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`${feed.source}: ${msg}`);
    }
  }

  return result;
}
