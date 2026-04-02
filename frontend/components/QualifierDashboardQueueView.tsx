import { useMemo, useState } from 'react';
import { QualifierLeadsTable } from './QualifierLeadsTable';
import type { QualifierLead } from './QualifierKanban';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { ArrowLeft } from 'lucide-react';

export type QualifierQueueKind =
  | 'qualify'
  | 'callback'
  | 'appointment'
  | 'sweep'
  | 'journey_no_contact'
  | 'journey_callback'
  | 'journey_appointment'
  | 'journey_sold'
  | 'journey_blowout';

/** Maps `LeadStatus` journey keys to queue drill-down kinds (pipeline cards). */
export function queueKindForJourneyStage(statusKey: string): QualifierQueueKind | null {
  const m: Record<string, QualifierQueueKind> = {
    NO_CONTACT: 'journey_no_contact',
    QUALIFIER_CALLBACK: 'journey_callback',
    APPOINTMENT_SET: 'journey_appointment',
    SOLD: 'journey_sold',
    NOT_INTERESTED: 'journey_blowout',
  };
  return m[statusKey] ?? null;
}

export function statusesForQueue(kind: QualifierQueueKind): string[] {
  switch (kind) {
    case 'qualify':
      return ['QUALIFYING'];
    case 'callback':
      return ['QUALIFIER_CALLBACK'];
    case 'appointment':
      return ['APPOINTMENT_SET'];
    case 'sweep':
      return ['NOT_INTERESTED', 'DEPOSITION'];
    case 'journey_no_contact':
      return ['NO_CONTACT'];
    case 'journey_callback':
      return ['QUALIFIER_CALLBACK'];
    case 'journey_appointment':
      return ['APPOINTMENT_SET'];
    case 'journey_sold':
      return ['SOLD'];
    case 'journey_blowout':
      return ['NOT_INTERESTED'];
    default:
      return [];
  }
}

function queueTitle(kind: QualifierQueueKind): string {
  switch (kind) {
    case 'qualify':
      return 'Leads to Qualify';
    case 'callback':
      return 'Callback';
    case 'appointment':
      return 'Appointment Set';
    case 'sweep':
      return 'Sweep';
    case 'journey_no_contact':
      return 'No Contact';
    case 'journey_callback':
      return 'Callback';
    case 'journey_appointment':
      return 'Appointment Set';
    case 'journey_sold':
      return 'Sold';
    case 'journey_blowout':
      return 'Blowout';
  }
}

function leadsInDateRange(lead: QualifierLead, dateFrom: string, dateTo: string): boolean {
  if (!dateFrom && !dateTo) return true;
  if (!lead.createdAt) return false;
  const created = new Date(lead.createdAt);
  if (Number.isNaN(created.getTime())) return false;
  if (dateFrom) {
    const start = new Date(`${dateFrom}T00:00:00`);
    if (created < start) return false;
  }
  if (dateTo) {
    const end = new Date(`${dateTo}T23:59:59.999`);
    if (created > end) return false;
  }
  return true;
}

interface QualifierDashboardQueueViewProps {
  kind: QualifierQueueKind;
  leads: QualifierLead[];
  loading: boolean;
  onBack: () => void;
  onUpdated: () => void;
}

export function QualifierDashboardQueueView({
  kind,
  leads,
  loading,
  onBack,
  onUpdated,
}: QualifierDashboardQueueViewProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const baseLeads = useMemo(
    () => leads.filter((l) => statusesForQueue(kind).includes(l.status ?? '')),
    [leads, kind]
  );

  const dateFilteredLeads = useMemo(
    () => baseLeads.filter((l) => leadsInDateRange(l, dateFrom, dateTo)),
    [baseLeads, dateFrom, dateTo]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to dashboard
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-muted/30 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="queue-date-from" className="text-xs text-muted-foreground">
            Created from
          </Label>
          <input
            id="queue-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex h-9 w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="queue-date-to" className="text-xs text-muted-foreground">
            Created to
          </Label>
          <input
            id="queue-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex h-9 w-[160px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          />
        </div>
        {(dateFrom || dateTo) && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
            Clear dates
          </Button>
        )}
      </div>

      <QualifierLeadsTable
        leads={dateFilteredLeads}
        loading={loading}
        onUpdated={onUpdated}
        title={queueTitle(kind)}
        subtitle="Filter by created date above, then search by name, phone, or email. Status updates are available from each lead’s detail sheet."
        hideStatusFilter
        statusStyle="pill"
      />
    </div>
  );
}
