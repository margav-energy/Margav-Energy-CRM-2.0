/** GBP for dashboard / pipeline (stored amounts are plain numbers). */
export function formatGbpCompact(amount: number): string {
  if (amount === 0) return '£0';
  if (Math.abs(amount) >= 1000) return `£${(amount / 1000).toFixed(1)}k`.replace(/\.0k$/, 'k');
  return `£${Math.round(amount).toLocaleString('en-GB')}`;
}

/** Full pounds with thousands separators, no pence unless needed. */
export function formatGbp(amount: number): string {
  return `£${Number(amount).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}
