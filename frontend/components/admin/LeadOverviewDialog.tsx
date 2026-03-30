import { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { LeadStatusPill, formatLeadStatusLabel } from '../../lib/leadStatusPill';
import { getLeadById, getLeadActivity } from '../../lib/api';

function fmtWhen(v: unknown): string {
  if (v == null) return '—';
  const d = typeof v === 'string' ? new Date(v) : v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[140px_1fr] sm:gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground break-words">{value || '—'}</span>
    </div>
  );
}

function renderActivityLine(item: Record<string, unknown>): string {
  const type = String(item.type ?? '');
  switch (type) {
    case 'status_change': {
      const from =
        item.fromStatus != null ? formatLeadStatusLabel(String(item.fromStatus)) : '(new)';
      const to = formatLeadStatusLabel(String(item.toStatus ?? ''));
      const by =
        item.changedBy && typeof item.changedBy === 'object' && item.changedBy && 'fullName' in item.changedBy
          ? ` · ${String((item.changedBy as { fullName: string }).fullName)}`
          : '';
      return `${from} → ${to}${by}`;
    }
    case 'sms':
      return `${String(item.direction ?? '')} SMS: ${String(item.body ?? '').slice(0, 120)}${String(item.body ?? '').length > 120 ? '…' : ''}`;
    case 'activity':
      return `${String(item.eventType ?? 'Event')}${item.metadata != null ? ` · ${JSON.stringify(item.metadata)}` : ''}`;
    case 'note':
      return `Note: ${String(item.content ?? '').slice(0, 200)}${String(item.content ?? '').length > 200 ? '…' : ''}`;
    case 'task':
      return `Task: ${String(item.title ?? '')} (${String(item.status ?? '')})`;
    case 'call':
      return `Call: ${String(item.outcome ?? '')}${item.notes ? ` — ${String(item.notes).slice(0, 80)}` : ''}`;
    default:
      return JSON.stringify(item);
  }
}

type OverviewTab = 'details' | 'timeline';

export function LeadOverviewDialog({
  leadId,
  open,
  onOpenChange,
  defaultTab = 'details',
}: {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: OverviewTab;
}) {
  const [tab, setTab] = useState<OverviewTab>(defaultTab);
  const prevOpen = useRef(false);
  const [lead, setLead] = useState<Record<string, unknown> | null>(null);
  const [activity, setActivity] = useState<unknown[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setTab(defaultTab);
    }
    prevOpen.current = open;
  }, [open, defaultTab]);

  useEffect(() => {
    if (!open || !leadId) {
      setLead(null);
      setActivity(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      getLeadById(leadId) as Promise<Record<string, unknown>>,
      getLeadActivity(leadId) as Promise<unknown[]>,
    ])
      .then(([l, a]) => {
        setLead(l);
        setActivity(Array.isArray(a) ? a : []);
      })
      .catch(() => {
        setError('Could not load lead.');
        setLead(null);
        setActivity([]);
      })
      .finally(() => setLoading(false));
  }, [open, leadId]);

  const name = lead
    ? `${String(lead.firstName ?? '')} ${String(lead.lastName ?? '')}`.trim() || 'Lead'
    : 'Lead';
  const status = lead ? String(lead.status ?? '') : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[min(90vh,720px)] flex flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0 space-y-2">
          <DialogTitle className="pr-8">{name}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            {status ? <LeadStatusPill status={status} /> : null}
            <span className="text-muted-foreground">Lead overview</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="px-6 py-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-destructive text-sm">{error}</div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as OverviewTab)} className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-6 mt-2 w-auto justify-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="timeline">Activity timeline</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="flex-1 overflow-y-auto px-6 pt-4 pb-6 mt-0 min-h-0 space-y-4">
              <div className="space-y-3 text-left">
                <DetailRow label="Phone" value={lead ? String(lead.phone ?? '') : ''} />
                <DetailRow label="Email" value={lead ? String(lead.email ?? '') : ''} />
                <DetailRow label="Source" value={lead ? String(lead.source ?? '') : ''} />
                <DetailRow label="Postcode" value={lead ? String(lead.postcode ?? '') : ''} />
                <DetailRow
                  label="Address"
                  value={
                    lead
                      ? [lead.addressLine1, lead.addressLine2, lead.city].filter(Boolean).join(', ')
                      : ''
                  }
                />
                <DetailRow label="Created" value={lead ? fmtWhen(lead.createdAt) : ''} />
                <DetailRow label="Updated" value={lead ? fmtWhen(lead.updatedAt) : ''} />
                <DetailRow
                  label="SMS automation"
                  value={lead && lead.smsAutomationStage != null ? String(lead.smsAutomationStage) : '—'}
                />
                <DetailRow
                  label="SMS automation paused"
                  value={lead && lead.smsAutomationPaused === true ? 'Yes' : 'No'}
                />
                <DetailRow label="Priority" value={lead && lead.priority === true ? 'Yes' : 'No'} />
                <DetailRow
                  label="Duplicate of"
                  value={
                    lead && typeof lead.duplicateOfLead === 'object' && lead.duplicateOfLead
                      ? `${String((lead.duplicateOfLead as { firstName?: string }).firstName ?? '')} ${String((lead.duplicateOfLead as { lastName?: string }).lastName ?? '')} (${String((lead.duplicateOfLead as { id?: string }).id ?? '')})`.trim()
                      : lead?.duplicateOfLeadId
                        ? String(lead.duplicateOfLeadId)
                        : '—'
                  }
                />
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assignments</p>
                  <DetailRow
                    label="Agent"
                    value={
                      lead && typeof lead.assignedAgent === 'object' && lead.assignedAgent && 'fullName' in lead.assignedAgent
                        ? String((lead.assignedAgent as { fullName: string }).fullName)
                        : ''
                    }
                  />
                  <DetailRow
                    label="Qualifier"
                    value={
                      lead &&
                      typeof lead.assignedQualifier === 'object' &&
                      lead.assignedQualifier &&
                      'fullName' in lead.assignedQualifier
                        ? String((lead.assignedQualifier as { fullName: string }).fullName)
                        : ''
                    }
                  />
                  <DetailRow
                    label="Field sales"
                    value={
                      lead &&
                      typeof lead.assignedFieldSalesRep === 'object' &&
                      lead.assignedFieldSalesRep &&
                      'fullName' in lead.assignedFieldSalesRep
                        ? String((lead.assignedFieldSalesRep as { fullName: string }).fullName)
                        : ''
                    }
                  />
                </div>
                {lead?.notes != null && String(lead.notes).trim() !== '' && (
                  <div className="pt-2 border-t space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words">{String(lead.notes)}</p>
                  </div>
                )}
                {Array.isArray(lead?.appointments) && (lead.appointments as unknown[]).length > 0 && (
                  <div className="pt-2 border-t space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next appointment</p>
                    {(() => {
                      const appts = lead!.appointments as Array<Record<string, unknown>>;
                      const a = appts[0];
                      return (
                        <p className="text-sm">
                          {fmtWhen(a.scheduledAt)} · {String(a.status ?? '')}
                          {typeof a.fieldSalesRep === 'object' &&
                            a.fieldSalesRep &&
                            'fullName' in a.fieldSalesRep &&
                            ` · ${String((a.fieldSalesRep as { fullName: string }).fullName)}`}
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="timeline" className="flex-1 overflow-y-auto px-6 pt-4 pb-6 mt-0 min-h-0">
              <ul className="space-y-3 text-left">
                {activity && activity.length > 0 ? (
                  activity.map((raw, i) => {
                    const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
                    if (!item) return null;
                    return (
                      <li key={String(item.id ?? i)} className="border-b border-border/60 pb-3 last:border-0 last:pb-0">
                        <p className="text-xs text-muted-foreground">{fmtWhen(item.createdAt)}</p>
                        <p className="text-sm text-foreground mt-1">{renderActivityLine(item)}</p>
                      </li>
                    );
                  })
                ) : (
                  <li className="text-sm text-muted-foreground">No activity yet.</li>
                )}
              </ul>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
