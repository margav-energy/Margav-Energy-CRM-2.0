import { cn } from '../components/ui/utils';

/** Matches backend `LeadStatus` / leads.validation leadStatusEnum */
export const ALL_LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'INTERESTED',
  'NOT_INTERESTED',
  'DEPOSITION',
  'QUALIFYING',
  'QUALIFIED',
  'NOT_QUALIFIED',
  'APPOINTMENT_SET',
  'NO_CONTACT',
  'QUALIFIER_CALLBACK',
] as const;

export type LeadStatusValue = (typeof ALL_LEAD_STATUSES)[number];

const STATUS_PILL_STYLES: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950/60 dark:text-blue-100 dark:border-blue-800',
  CONTACTED: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/60 dark:text-sky-100 dark:border-sky-800',
  INTERESTED: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-100 dark:border-emerald-800',
  NOT_INTERESTED: 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600',
  DEPOSITION: 'bg-stone-200 text-stone-900 border-stone-300 dark:bg-stone-800 dark:text-stone-100 dark:border-stone-600',
  QUALIFYING: 'bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-950/60 dark:text-violet-100 dark:border-violet-800',
  QUALIFIED: 'bg-green-100 text-green-900 border-green-200 dark:bg-green-950/60 dark:text-green-100 dark:border-green-800',
  NOT_QUALIFIED: 'bg-red-100 text-red-900 border-red-200 dark:bg-red-950/60 dark:text-red-100 dark:border-red-800',
  APPOINTMENT_SET: 'bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-950/60 dark:text-teal-100 dark:border-teal-800',
  NO_CONTACT: 'bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-950/60 dark:text-orange-100 dark:border-orange-800',
  QUALIFIER_CALLBACK: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-100 dark:border-amber-800',
};

export function formatLeadStatusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function leadStatusPillClassName(status: string): string {
  return STATUS_PILL_STYLES[status] ?? 'bg-muted text-foreground border-border';
}

export function LeadStatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums',
        leadStatusPillClassName(status),
        className,
      )}
    >
      <span className="truncate">{formatLeadStatusLabel(status)}</span>
    </span>
  );
}
