/**
 * Temporary UI to trigger /api/sms-journey/* without Postman.
 * Shown when VITE_SHOW_SMS_JOURNEY_DEV=true or in dev (import.meta.env.DEV).
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  getFieldSalesReps,
  getAppointments,
  smsJourneySendInitial,
  smsJourneyCallOutcome,
  smsJourneyBookAppointment,
  smsJourneyProcessNoReplies,
  smsJourneyCronAppointmentReminders,
  smsJourneyCronSurveyorOnRoute,
  smsJourneyCronNextDayFollowup,
  smsJourneySurveyorOnRoute,
  type SmsJourneyCallOutcomeType,
} from '../../lib/api';

type LeadOpt = { id: string; firstName: string; lastName: string; phone: string };

const OUTCOMES: SmsJourneyCallOutcomeType[] = [
  'NO_ANSWER',
  'CALLBACK_REQUESTED',
  'WRONG_NUMBER',
  'NOT_INTERESTED',
  'APPOINTMENT_BOOKED',
];

export function SmsJourneyDevPanel({ leads }: { leads: LeadOpt[] }) {
  const [reps, setReps] = useState<Array<{ id: string; fullName: string }>>([]);
  const [appointments, setAppointments] = useState<Array<{ id: string; scheduledAt: string; leadId: string }>>([]);
  const [leadId, setLeadId] = useState('');
  const [outcome, setOutcome] = useState<SmsJourneyCallOutcomeType>('NO_ANSWER');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [repId, setRepId] = useState('');
  const [bookWhen, setBookWhen] = useState('');
  const [noReplySeconds, setNoReplySeconds] = useState('60');
  const [apptId, setApptId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getFieldSalesReps()
      .then((r) => setReps(r))
      .catch(() => setReps([]));
    getAppointments({ pageSize: 50, status: 'SCHEDULED' })
      .then((r) => {
        const items = (r.items ?? []) as Array<{ id: string; scheduledAt: string; leadId: string }>;
        setAppointments(items);
      })
      .catch(() => setAppointments([]));
  }, []);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const data = await fn();
      setMsg(`${label}: OK — ${JSON.stringify(data).slice(0, 400)}`);
    } catch (e) {
      setMsg(`${label}: ${e instanceof Error ? e.message : 'Failed'}`);
    } finally {
      setBusy(false);
    }
  };

  const isoFromLocal = (local: string) => {
    if (!local) return new Date().toISOString();
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  };

  if (!import.meta.env.DEV && import.meta.env.VITE_SHOW_SMS_JOURNEY_DEV !== 'true') {
    return null;
  }

  return (
    <Card className="border-amber-400/80 bg-amber-50/40 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="text-amber-900 dark:text-amber-100">
          Temporary: SMS journey triggers (remove in production)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Admin only. Calls backend <code className="text-xs bg-muted px-1 rounded">/api/sms-journey/*</code>. With{' '}
          <code className="text-xs bg-muted px-1">SMS_JOURNEY_TEST_MODE</code>, delays are seconds;{' '}
          <code className="text-xs bg-muted px-1">process-no-replies</code> uses <strong>seconds</strong> as the{' '}
          <code className="text-xs bg-muted px-1">hours</code> body value.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Lead</Label>
          <Select value={leadId} onValueChange={setLeadId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select lead" />
            </SelectTrigger>
            <SelectContent>
              {leads.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.firstName} {l.lastName} ({l.phone})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !leadId}
            onClick={() => run('send-initial', () => smsJourneySendInitial(leadId))}
          >
            Send initial SMS (#1 / #2)
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <Label>Call outcome (SMS #3–5, #9)</Label>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as SmsJourneyCallOutcomeType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>
        <Button
          type="button"
          disabled={busy || !leadId}
          onClick={() =>
            run('call-outcome', () => smsJourneyCallOutcome(leadId, outcome, outcomeNotes || undefined))
          }
        >
          POST call-outcome
        </Button>

        <div className="border-t pt-4 space-y-2">
          <Label>Book appointment → SMS #6 (journey)</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger>
                <SelectValue placeholder="Field sales rep" />
              </SelectTrigger>
              <SelectContent>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="datetime-local"
              value={bookWhen}
              onChange={(e) => setBookWhen(e.target.value)}
            />
            <Button
              type="button"
              disabled={busy || !leadId || !repId}
              onClick={() =>
                run('book-appointment', () =>
                  smsJourneyBookAppointment({
                    leadId,
                    fieldSalesRepId: repId,
                    scheduledAt: isoFromLocal(bookWhen),
                    notes: 'Dev panel',
                  })
                )
              }
            >
              Book (journey)
            </Button>
          </div>
        </div>

        <div className="border-t pt-4 space-y-2">
          <Label>Process no-replies (body &quot;hours&quot; = seconds in test mode)</Label>
          <div className="flex gap-2 items-end">
            <Input
              className="max-w-[120px]"
              value={noReplySeconds}
              onChange={(e) => setNoReplySeconds(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run('process-no-replies', () =>
                  smsJourneyProcessNoReplies(parseInt(noReplySeconds, 10) || 60)
                )
              }
            >
              process-no-replies
            </Button>
          </div>
        </div>

        <div className="border-t pt-4">
          <Label className="mb-2 block">Cron (one-shot)</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => run('cron/appointment-reminders', () => smsJourneyCronAppointmentReminders())}
            >
              #7 appointment-reminders
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => run('cron/surveyor-on-route', () => smsJourneyCronSurveyorOnRoute())}
            >
              #8 surveyor-on-route (batch)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => run('cron/next-day-followup', () => smsJourneyCronNextDayFollowup())}
            >
              #4 next-day-followup
            </Button>
          </div>
        </div>

        <div className="border-t pt-4 space-y-2">
          <Label>Surveyor on route (single appointment)</Label>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={apptId} onValueChange={setApptId}>
              <SelectTrigger className="min-w-[240px]">
                <SelectValue placeholder="Pick from list" />
              </SelectTrigger>
              <SelectContent>
                {appointments.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.id.slice(0, 8)}… @ {new Date(a.scheduledAt).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">or</span>
            <Input
              placeholder="Appointment ID (paste)"
              className="max-w-[280px] font-mono text-sm"
              value={apptId}
              onChange={(e) => setApptId(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy || !apptId.trim()}
              onClick={() => run('surveyor-on-route', () => smsJourneySurveyorOnRoute(apptId.trim()))}
            >
              SMS #8 (one appt)
            </Button>
          </div>
        </div>

        {msg && (
          <pre className="text-xs whitespace-pre-wrap break-words rounded border bg-muted/50 p-3 max-h-40 overflow-auto">
            {msg}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
