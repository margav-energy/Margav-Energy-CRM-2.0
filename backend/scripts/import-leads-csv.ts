/**
 * Import leads from CSV file.
 * Place your exported CSV at: backend/data/leads_import.csv
 *
 * Expected columns (flexible - will map common variations):
 * - Lead First Name / First Name / firstName
 * - Lead Last Name / Last Name / lastName
 * - Email
 * - Phone Number / Phone / phone
 * - Address Line 1 / Address
 * - Address Line 2
 * - City
 * - State
 * - Zip Code / Zip / Postcode / postcode
 * - Country
 * - Source (BLC, Rattle, Leadwise, etc.)
 * - Status (New Lead, Contacted, Qualified, etc.)
 * - Assigned To
 * - Creation Date / Created At
 * - Notes
 * - Company Name
 * - Industry
 * - Lead Score
 * - Campaign
 * - Original Lead ID / ID
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Map dataset status values to our LeadStatus enum
const STATUS_MAP: Record<string, string> = {
  'new lead': 'NEW',
  'new': 'NEW',
  'contacted': 'CONTACTED',
  'qualified': 'QUALIFIED',
  'unqualified': 'NOT_QUALIFIED',
  'closed won': 'SOLD',
  'closed lost': 'NOT_INTERESTED',
  'follow-up': 'QUALIFIER_CALLBACK',
  'follow up': 'QUALIFIER_CALLBACK',
  'interested': 'INTERESTED',
  'not interested': 'NOT_INTERESTED',
  'deposition': 'DEPOSITION',
  'qualifying': 'QUALIFYING',
  'not qualified': 'NOT_QUALIFIED',
  'appointment set': 'APPOINTMENT_SET',
  'no contact': 'NO_CONTACT',
  'callback': 'QUALIFIER_CALLBACK',
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if ((c === ',' && !inQuotes) || c === '\n') {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function getColumn(row: Record<string, string>, ...names: string[]): string {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeHeader(k), v])
  );
  for (const n of names) {
    const key = Object.keys(normalized).find((k) => normalizeHeader(k) === n || k.includes(n.toLowerCase()));
    if (key && normalized[key]) return String(normalized[key]).trim();
  }
  return '';
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function mapStatus(val: string): string {
  const lower = val.toLowerCase().trim();
  return STATUS_MAP[lower] ?? 'NEW';
}

async function main() {
  const clearFirst = process.argv.includes('--clear');
  const dataPath = path.join(__dirname, '../data/leads_import.csv');

  if (clearFirst) {
    console.log('Clearing existing leads...');
    await prisma.lead.deleteMany({});
    console.log('Done. Existing leads removed.');
  }

  if (!fs.existsSync(dataPath)) {
    console.error('File not found:', dataPath);
    console.log('\nTo import leads:');
    console.log('1. Export your spreadsheet to CSV');
    console.log('2. Save it as backend/data/leads_import.csv');
    console.log('3. Run: npm run db:import-leads');
    process.exit(1);
  }

  const content = fs.readFileSync(dataPath, 'utf-8');
  const rows = parseCSV(content);
  if (rows.length === 0) {
    console.log('No rows found in CSV.');
    process.exit(0);
  }

  console.log(`Found ${rows.length} rows. Importing...`);

  const users = await prisma.user.findMany({ select: { id: true, fullName: true } });
  const userByName = new Map(users.map((u) => [u.fullName.toLowerCase(), u.id]));

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const firstName = getColumn(row, 'lead first name', 'first name', 'firstname');
    const lastName = getColumn(row, 'lead last name', 'last name', 'lastname');
    const email = getColumn(row, 'email');
    const phone = getColumn(row, 'phone number', 'phone');

    if (!firstName && !lastName && !email && !phone) {
      skipped++;
      continue;
    }

    const assignedTo = getColumn(row, 'assigned to');
    const assignedAgentId = assignedTo
      ? userByName.get(assignedTo.toLowerCase()) ?? users[0]?.id
      : users[0]?.id;

    const statusVal = getColumn(row, 'status');
    const status = mapStatus(statusVal) as any;

    const creationDate = parseDate(getColumn(row, 'creation date', 'created at', 'created'));
    const createdAt = creationDate ?? new Date();

    try {
      await prisma.lead.create({
        data: {
          firstName: firstName || 'Unknown',
          lastName: lastName || 'Unknown',
          email: email || `import-${Date.now()}-${created}@placeholder.local`,
          phone: phone || '0000000000',
          addressLine1: getColumn(row, 'address line 1', 'address') || undefined,
          addressLine2: getColumn(row, 'address line 2') || undefined,
          city: getColumn(row, 'city') || undefined,
          state: getColumn(row, 'state') || undefined,
          postcode: getColumn(row, 'zip code', 'zip', 'postcode') || undefined,
          country: getColumn(row, 'country') || undefined,
          source: getColumn(row, 'source') || undefined,
          status,
          companyName: getColumn(row, 'company name') || undefined,
          industry: getColumn(row, 'industry') || undefined,
          leadScore: parseInt(getColumn(row, 'lead score'), 10) || undefined,
          nextAction: getColumn(row, 'next action') || undefined,
          nextActionDate: parseDate(getColumn(row, 'next action date')) ?? undefined,
          campaign: getColumn(row, 'campaign') || undefined,
          originalLeadId: getColumn(row, 'original lead id', 'id') || undefined,
          notes: getColumn(row, 'notes') || undefined,
          assignedAgentId: assignedAgentId ?? undefined,
          createdAt,
          updatedAt: createdAt,
        },
      });
      created++;
    } catch (e) {
      console.warn('Skip row:', firstName, lastName, (e as Error).message);
      skipped++;
    }
  }

  console.log(`Imported ${created} leads. Skipped ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
