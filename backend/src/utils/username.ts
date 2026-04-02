import { prisma } from '../db';

/**
 * Display / login pattern: First name (capitalized) + first letter of last name, e.g. John + D → JohnD.
 * Stored canonical form is lowercase for uniqueness.
 */
export function generateUsernameBase(firstName: string, lastName: string): string {
  const first = firstName.trim().split(/\s+/).filter(Boolean)[0] ?? '';
  const last = lastName.trim().split(/\s+/).filter(Boolean)[0] ?? '';
  if (!first || !last) {
    throw new Error('First name and last name are required');
  }
  const fn = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  const li = last.charAt(0).toUpperCase();
  return `${fn}${li}`;
}

export function usernameCanonicalFromBase(base: string): string {
  const s = base.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return s || 'user';
}

/** For API display when only fullName exists (e.g. legacy rows). */
export function displayUsernameFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) {
    const w = parts[0];
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }
  const first = parts[0];
  const last = parts[parts.length - 1];
  return generateUsernameBase(first, last);
}

/**
 * Allocate unique username (lowercase): johnd, johnd2, johnd3, …
 */
export async function allocateUsername(firstName: string, lastName: string): Promise<string> {
  const base = generateUsernameBase(firstName, lastName);
  const canonical = usernameCanonicalFromBase(base);
  let candidate = canonical;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${canonical}${suffix}`;
  }
  return candidate;
}
