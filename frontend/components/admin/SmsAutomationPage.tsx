import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { SummaryCard } from '../SummaryCard';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { MessageSquare, Send, Reply, Ban, Calendar, AlertTriangle } from 'lucide-react';
import { getSmsMetrics, getAdminLeads, sendSmsToLead } from '../../lib/api';
import type { SmsMetrics } from '../../lib/admin-types';
import { SmsJourneyDevPanel } from './SmsJourneyDevPanel';

const MOCK_TEMPLATES = [
  { id: 't1', name: 'Welcome', body: "Hi {{leadName}}, thanks for your interest in solar! We'll reach out shortly.", variables: ['leadName'], isActive: true },
  { id: 't2', name: 'Appointment Reminder', body: 'Hi {{leadName}}, your appointment is tomorrow. Reply YES to confirm.', variables: ['leadName', 'repName', 'time'], isActive: true },
  { id: 't3', name: 'Follow-up', body: "Hi {{leadName}}, just checking in. Have you had a chance to review our proposal?", variables: ['leadName'], isActive: true },
];

export function SmsAutomationPage() {
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [metrics, setMetrics] = useState<SmsMetrics | null>(null);
  const [leads, setLeads] = useState<Array<{ id: string; firstName: string; lastName: string; phone: string }>>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [smsBody, setSmsBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    getSmsMetrics().then((m) => setMetrics(m as SmsMetrics)).catch(() => setMetrics(null));
    getAdminLeads({ pageSize: 100 }).then((r) => setLeads((r.items as Array<{ id: string; firstName: string; lastName: string; phone: string }>).filter((l) => l.phone)));
  }, []);

  const handleSendSms = async () => {
    if (!selectedLeadId || !smsBody.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await sendSmsToLead(selectedLeadId, smsBody.trim());
      setSendResult({ ok: res.success, msg: res.success ? 'SMS sent' : (res.message ?? 'Failed') });
      if (res.success) setSmsBody('');
      getSmsMetrics().then((m) => setMetrics(m as SmsMetrics));
    } catch (err) {
      setSendResult({ ok: false, msg: err instanceof Error ? err.message : 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <SmsJourneyDevPanel leads={leads} />

      {/* Global toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>SMS Automation</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enable or disable SMS automation globally. Pause per lead from Lead Operations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{automationEnabled ? 'Enabled' : 'Disabled'}</span>
              <Switch checked={automationEnabled} onCheckedChange={setAutomationEnabled} />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Send SMS from Admin */}
      <Card>
        <CardHeader>
          <CardTitle>Send SMS to Lead</CardTitle>
          <p className="text-sm text-muted-foreground">
            Send a manual SMS to any lead. Use for follow-ups or custom messages.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Lead</Label>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a lead" />
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
            <div>
              <Label>Message</Label>
              <Input
                placeholder="Type your message..."
                value={smsBody}
                onChange={(e) => setSmsBody(e.target.value)}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground mt-1">{smsBody.length}/160 chars</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={handleSendSms} disabled={sending || !selectedLeadId || !smsBody.trim()}>
              {sending ? 'Sending...' : 'Send SMS'}
            </Button>
            {sendResult && (
              <span className={sendResult.ok ? 'text-green-600' : 'text-destructive'}>{sendResult.msg}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <SummaryCard
          title="Sent Today"
          value={metrics?.sentToday ?? 0}
          icon={Send}
          change={`This week: ${metrics?.sentThisWeek ?? 0}`}
          changeType="neutral"
        />
        <SummaryCard
          title="Sent This Month"
          value={metrics?.sentThisMonth ?? 0}
          icon={MessageSquare}
          change="+8% from last month"
          changeType="positive"
        />
        <SummaryCard
          title="Reply Rate"
          value={`${((metrics?.replyRate ?? 0) * 100).toFixed(1)}%`}
          icon={Reply}
          change="Target: 40%"
          changeType={(metrics?.replyRate ?? 0) >= 0.4 ? 'positive' : 'neutral'}
        />
        <SummaryCard
          title="Opt-out Rate"
          value={`${((metrics?.optOutRate ?? 0) * 100).toFixed(1)}%`}
          icon={Ban}
          change="Target: &lt;3%"
          changeType={(metrics?.optOutRate ?? 0) < 0.03 ? 'positive' : 'negative'}
        />
        <SummaryCard
          title="Booked via SMS"
          value={metrics?.bookedViaSms ?? 0}
          icon={Calendar}
          change="This month"
          changeType="positive"
        />
        <SummaryCard
          title="Failed Delivery"
          value={metrics?.failedDelivery ?? 0}
          icon={AlertTriangle}
          change="Needs attention"
          changeType={(metrics?.failedDelivery ?? 0) > 0 ? 'negative' : 'neutral'}
        />
      </div>

      {/* Conversation metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Active Conversations"
          value={metrics?.activeConversations ?? 0}
          icon={MessageSquare}
          change="Threads with recent activity"
          changeType="neutral"
        />
        <SummaryCard
          title="Waiting for Reply"
          value={metrics?.waitingForReply ?? 0}
          icon={Reply}
          change="Outbound sent, no reply 24h"
          changeType="neutral"
        />
        <SummaryCard
          title="Requiring Takeover"
          value={metrics?.requiringTakeover ?? 0}
          icon={AlertTriangle}
          change="Flagged for human"
          changeType={(metrics?.requiringTakeover ?? 0) > 0 ? 'negative' : 'neutral'}
        />
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle>SMS Templates</CardTitle>
          <p className="text-sm text-muted-foreground">
            Edit templates used in automation sequences. Variables: {'{{leadName}}'}, {'{{repName}}'}, {'{{time}}'}.
          </p>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Body</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_TEMPLATES.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell className="font-medium">{tpl.name}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">{tpl.body}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {tpl.variables.map((v) => (
                          <Badge key={v} variant="outline" className="text-xs">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {tpl.isActive ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost">Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Automation Rules placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Rules</CardTitle>
          <p className="text-sm text-muted-foreground">
            Trigger, delay, and sequence. E.g. LEAD_CREATED → 5 min → Welcome template.
          </p>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center rounded-lg border border-dashed text-muted-foreground">
            Automation rules editor. Configure triggers, delays, and template assignment.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
