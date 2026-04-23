/** How long a dismissed notification stays hidden while the server still reports the same issue. After this, it shows again. */
export const NOTIFICATION_DISMISS_SNOOZE_MS = 10 * 60 * 1000;

const STORAGE_KEY = 'margav_notification_dismissals';

export type DismissRecord = { message: string; at: number };

export function loadNotificationDismissals(): Record<string, DismissRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DismissRecord>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveNotificationDismissals(d: Record<string, DismissRecord>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

/** Drop very old rows so localStorage stays small. */
export function pruneStaleDismissals(d: Record<string, DismissRecord>): Record<string, DismissRecord> {
  const cutoff = Date.now() - NOTIFICATION_DISMISS_SNOOZE_MS - 7 * 24 * 60 * 60 * 1000;
  const out: Record<string, DismissRecord> = {};
  for (const [id, rec] of Object.entries(d)) {
    if (rec && typeof rec.at === 'number' && rec.at > cutoff) {
      out[id] = rec;
    }
  }
  return out;
}

/** Remove dismiss entries for notification ids no longer returned (issue resolved). */
export function dropDismissalsNotInCurrentSet(
  dismissed: Record<string, DismissRecord>,
  currentIds: Set<string>
): Record<string, DismissRecord> {
  const out: Record<string, DismissRecord> = {};
  for (const [id, rec] of Object.entries(dismissed)) {
    if (currentIds.has(id)) out[id] = rec;
  }
  return out;
}

export function shouldShowNotification(
  id: string,
  message: string,
  dismissed: Record<string, DismissRecord>
): boolean {
  const d = dismissed[id];
  if (!d) return true;
  if (d.message !== message) return true;
  if (Date.now() - d.at >= NOTIFICATION_DISMISS_SNOOZE_MS) return true;
  return false;
}
