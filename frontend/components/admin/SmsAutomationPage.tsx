import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  MessageSquare,
  Send,
  Reply,
  Ban,
  Calendar,
  AlertTriangle,
  Users,
  Clock3,
  CheckCircle2,
  Mail,
  Pencil,
} from 'lucide-react';
import { getSmsMetrics, getAdminLeads, getSmsThreads, sendSmsToLead } from '../../lib/api';
import type { SmsMetrics } from '../../lib/admin-types';

const MOCK_TEMPLATES = [
  { id: 't1', name: 'Welcome', body: "Hi {{leadName}}, thanks for your interest in solar! We'll reach out shortly.", variables: ['leadName'], isActive: true },
  { id: 't2', name: 'Appointment Reminder', body: 'Hi {{leadName}}, your appointment is tomorrow. Reply YES to confirm.', variables: ['leadName', 'repName', 'time'], isActive: true },
  { id: 't3', name: 'Follow-up', body: "Hi {{leadName}}, just checking in. Have you had a chance to review our proposal?", variables: ['leadName'], isActive: true },
];

type TemplateItem = {
  id: string;
  name: string;
  body: string;
  variables: string[];
  isActive: boolean;
};

export function SmsAutomationPage() {
  const [automationEnabled, setAutomationEnabled] = useState(true);
  const [metrics, setMetrics] = useState<SmsMetrics | null>(null);
  const [leads, setLeads] = useState<Array<{ id: string; firstName: string; lastName: string; phone: string }>>([]);
  const [threads, setThreads] = useState<
    Array<{
      id: string;
      leadId: string;
      status: 'ACTIVE' | 'ARCHIVED';
      lead: { firstName: string; lastName: string; status: string; smsAutomationStage?: string | null };
      lastMessage: { body: string; direction: 'INBOUND' | 'OUTBOUND'; createdAt: string } | null;
      customerReplyAt?: string | null;
      lastMessageAt?: string | null;
    }>
  >([]);
  const [threadSearch, setThreadSearch] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [smsBody, setSmsBody] = useState('');
  const [sendMode, setSendMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'active'>('all');
  const [viewMode, setViewMode] = useState<'compose' | 'campaigns'>('compose');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'replied' | 'awaiting'>('all');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>(MOCK_TEMPLATES);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateVars, setTemplateVars] = useState('');
  const [templateActive, setTemplateActive] = useState(true);
  const [activeEditor, setActiveEditor] = useState<'sms' | 'email' | 'template'>('sms');
  const composeCardRef = useRef<HTMLDivElement | null>(null);
  const smsInputRef = useRef<HTMLInputElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const templateBodyRef = useRef<HTMLTextAreaElement | null>(null);

  const loadThreads = async (search?: string) => {
    setLoadingThreads(true);
    try {
      const items = await getSmsThreads({ limit: 50, search: search?.trim() || undefined, status: 'ACTIVE' });
      setThreads(items);
    } catch {
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    getSmsMetrics().then((m) => setMetrics(m as SmsMetrics)).catch(() => setMetrics(null));
    getAdminLeads({ pageSize: 100 }).then((r) => setLeads((r.items as Array<{ id: string; firstName: string; lastName: string; phone: string }>).filter((l) => l.phone)));
    loadThreads();
  }, []);

  const handleSendSms = async () => {
    if (!selectedLeadId || !smsBody.trim()) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await sendSmsToLead(selectedLeadId, smsBody.trim());
      setSendResult({ ok: res.success, msg: res.success ? 'SMS sent' : (res.message ?? 'Failed') });
      if (res.success) {
        setSmsBody('');
        setScheduledAt('');
      }
      getSmsMetrics().then((m) => setMetrics(m as SmsMetrics));
      loadThreads(threadSearch);
    } catch (err) {
      setSendResult({ ok: false, msg: err instanceof Error ? err.message : 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
  };

  const selectableLeads =
    audienceFilter === 'active'
      ? leads.filter((l) => threads.some((t) => t.leadId === l.id))
      : leads;

  const filteredThreads = useMemo(() => {
    if (campaignFilter === 'replied') return threads.filter((t) => Boolean(t.customerReplyAt));
    if (campaignFilter === 'awaiting') return threads.filter((t) => !t.customerReplyAt);
    return threads;
  }, [campaignFilter, threads]);

  const applyTemplate = (templateId: string) => {
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    setSmsBody(template.body);
    setSendResult({ ok: true, msg: `Template "${template.name}" added to composer` });
    setViewMode('compose');
    setChannel('sms');
    composeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const openCreateTemplate = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateBody('');
    setTemplateVars('');
    setTemplateActive(true);
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (templateId: string) => {
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateBody(template.body);
    setTemplateVars(template.variables.join(', '));
    setTemplateActive(template.isActive);
    setTemplateDialogOpen(true);
  };

  const saveTemplate = () => {
    const name = templateName.trim();
    const body = templateBody.trim();
    if (!name || !body) return;
    const variables = templateVars
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    if (editingTemplateId) {
      setTemplates((prev) =>
        prev.map((tpl) =>
          tpl.id === editingTemplateId
            ? { ...tpl, name, body, variables, isActive: templateActive }
            : tpl,
        ),
      );
      setSendResult({ ok: true, msg: `Template "${name}" updated` });
    } else {
      const id = `t${Date.now()}`;
      setTemplates((prev) => [...prev, { id, name, body, variables, isActive: templateActive }]);
      setSendResult({ ok: true, msg: `Template "${name}" created` });
    }

    setTemplateDialogOpen(false);
  };

  const variableTokens = ['{{leadName}}', '{{repName}}', '{{time}}', '{{source}}', '{{appointmentDate}}'];

  const insertAtCursor = (
    currentValue: string,
    setter: (next: string) => void,
    input: HTMLInputElement | HTMLTextAreaElement | null,
    token: string,
  ) => {
    if (!input) {
      setter(currentValue ? `${currentValue} ${token}` : token);
      return;
    }
    const start = input.selectionStart ?? currentValue.length;
    const end = input.selectionEnd ?? currentValue.length;
    const nextValue = `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`;
    setter(nextValue);
    queueMicrotask(() => {
      input.focus();
      const caret = start + token.length;
      input.setSelectionRange(caret, caret);
    });
  };

  const insertVariableToken = (token: string) => {
    if (activeEditor === 'email') {
      insertAtCursor(emailBody, setEmailBody, emailInputRef.current, token);
      return;
    }
    if (activeEditor === 'template') {
      insertAtCursor(templateBody, setTemplateBody, templateBodyRef.current, token);
      return;
    }
    insertAtCursor(smsBody, setSmsBody, smsInputRef.current, token);
  };

  const handleVariableDrop = (
    event: DragEvent<HTMLInputElement | HTMLTextAreaElement>,
    target: 'sms' | 'email' | 'template',
  ) => {
    event.preventDefault();
    const token = event.dataTransfer.getData('text/plain');
    if (!token) return;
    setActiveEditor(target);
    if (target === 'email') {
      insertAtCursor(emailBody, setEmailBody, emailInputRef.current, token);
    } else if (target === 'template') {
      insertAtCursor(templateBody, setTemplateBody, templateBodyRef.current, token);
    } else {
      insertAtCursor(smsBody, setSmsBody, smsInputRef.current, token);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="space-y-6 rounded-3xl border border-indigo-200/60 bg-gradient-to-br from-white via-indigo-50/20 to-sky-50/20 p-5 sm:p-6">
        <Card className="rounded-2xl border-indigo-200/60 shadow-sm" ref={composeCardRef}>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Campaigns</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Build SMS and email campaigns with clear steps, live stats, and campaign history.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={() => setViewMode('compose')}>
                  + Create
                </Button>
                <span className="text-sm font-medium">{automationEnabled ? 'Enabled' : 'Disabled'}</span>
                <Switch checked={automationEnabled} onCheckedChange={setAutomationEnabled} />
              </div>
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'compose' | 'campaigns')}>
              <TabsList>
                <TabsTrigger value="compose">Compose</TabsTrigger>
                <TabsTrigger value="campaigns">All campaigns</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <Tabs value={viewMode}>
              <TabsContent value="compose" className="mt-0 space-y-4">
                <div className="rounded-xl border border-dashed bg-muted/20 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Drag variables into message fields
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {variableTokens.map((token) => (
                      <button
                        key={token}
                        type="button"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', token)}
                        onClick={() => insertVariableToken(token)}
                        className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                </div>
                <Tabs value={channel} onValueChange={(v) => setChannel(v as 'sms' | 'email')}>
                  <TabsList>
                    <TabsTrigger value="sms">
                      <MessageSquare className="mr-1 h-4 w-4" />
                      SMS
                    </TabsTrigger>
                    <TabsTrigger value="email">
                      <Mail className="mr-1 h-4 w-4" />
                      Email
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="sms" className="mt-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <Label>Audience segment</Label>
                            <Select value={audienceFilter} onValueChange={(v) => setAudienceFilter(v as 'all' | 'active')}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All leads with phone</SelectItem>
                                <SelectItem value="active">Active conversation leads</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Lead</Label>
                            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a lead" />
                              </SelectTrigger>
                              <SelectContent>
                                {selectableLeads.map((l) => (
                                  <SelectItem key={l.id} value={l.id}>
                                    {l.firstName} {l.lastName} ({l.phone})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label>Message</Label>
                          <Input
                            ref={smsInputRef}
                            placeholder="Type your campaign message..."
                            value={smsBody}
                            onChange={(e) => setSmsBody(e.target.value)}
                            onFocus={() => setActiveEditor('sms')}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleVariableDrop(e, 'sms')}
                            maxLength={160}
                          />
                          <p className="mt-1 text-xs text-muted-foreground">{smsBody.length}/160 chars</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Send time</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={sendMode === 'now' ? 'default' : 'outline'}
                              onClick={() => setSendMode('now')}
                            >
                              Send now
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={sendMode === 'later' ? 'default' : 'outline'}
                              onClick={() => setSendMode('later')}
                            >
                              Schedule for later
                            </Button>
                          </div>
                          {sendMode === 'later' ? (
                            <Input
                              type="datetime-local"
                              value={scheduledAt}
                              onChange={(e) => setScheduledAt(e.target.value)}
                            />
                          ) : null}
                        </div>
                        <div className="flex items-center gap-4">
                          <Button onClick={handleSendSms} disabled={sending || !selectedLeadId || !smsBody.trim() || (sendMode === 'later' && !scheduledAt)}>
                            {sending ? 'Sending...' : sendMode === 'later' ? 'Schedule campaign' : 'Send campaign'}
                          </Button>
                          {sendResult ? (
                            <span className={sendResult.ok ? 'text-green-600' : 'text-destructive'}>{sendResult.msg}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                        <p className="text-sm font-medium">Campaign Preview</p>
                        <div className="rounded-lg border bg-background p-3 text-sm">
                          {smsBody.trim() || 'Your message preview will appear here.'}
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p>Recipients: {selectedLeadId ? 1 : 0}</p>
                          <p>Mode: {sendMode === 'now' ? 'Immediate' : 'Scheduled'}</p>
                          <p>Schedule: {sendMode === 'later' && scheduledAt ? new Date(scheduledAt).toLocaleString() : '—'}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="email" className="mt-4 space-y-4">
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-sm font-medium">Email Campaign Composer</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Email campaign UX is now included in this dashboard. Delivery integration can be connected next.
                      </p>
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label>Audience segment</Label>
                          <Select value={audienceFilter} onValueChange={(v) => setAudienceFilter(v as 'all' | 'active')}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All leads with email</SelectItem>
                              <SelectItem value="active">Recently active leads</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Subject</Label>
                          <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Campaign subject" />
                        </div>
                      </div>
                      <div className="mt-4">
                        <Label>Message</Label>
                        <Input
                          ref={emailInputRef}
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          onFocus={() => setActiveEditor('email')}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleVariableDrop(e, 'email')}
                          placeholder="Draft your email message"
                        />
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <Button
                          onClick={() => setSendResult({ ok: true, msg: 'Email campaign draft saved' })}
                          disabled={!emailSubject.trim() || !emailBody.trim()}
                        >
                          Save draft
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSendResult({ ok: true, msg: 'Email campaign queued (integration pending)' })}
                          disabled={!emailSubject.trim() || !emailBody.trim()}
                        >
                          Queue campaign
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </TabsContent>

              <TabsContent value="campaigns" className="mt-0 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant={campaignFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setCampaignFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    size="sm"
                    variant={campaignFilter === 'replied' ? 'default' : 'outline'}
                    onClick={() => setCampaignFilter('replied')}
                  >
                    Replied
                  </Button>
                  <Button
                    size="sm"
                    variant={campaignFilter === 'awaiting' ? 'default' : 'outline'}
                    onClick={() => setCampaignFilter('awaiting')}
                  >
                    Awaiting reply
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search name, phone, email"
                    value={threadSearch}
                    onChange={(e) => setThreadSearch(e.target.value)}
                    className="w-[300px]"
                  />
                  <Button variant="outline" onClick={() => loadThreads(threadSearch)} disabled={loadingThreads}>
                    {loadingThreads ? 'Loading...' : 'Refresh'}
                  </Button>
                </div>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Message</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead>Reply State</TableHead>
                        <TableHead className="w-[160px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredThreads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            {loadingThreads ? 'Loading campaigns...' : 'No campaigns in this filter'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredThreads.map((thread) => (
                          <TableRow key={thread.id}>
                            <TableCell>
                              <div className="font-medium">
                                {thread.lead.firstName} {thread.lead.lastName}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{thread.lead.status}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[360px]">
                              {thread.lastMessage ? (
                                <span className="text-muted-foreground">
                                  {thread.lastMessage.direction === 'INBOUND' ? 'Lead: ' : 'Team: '}
                                  {thread.lastMessage.body}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">No messages yet</span>
                              )}
                            </TableCell>
                            <TableCell>{formatDateTime(thread.lastMessageAt ?? thread.lastMessage?.createdAt)}</TableCell>
                            <TableCell>
                              {thread.customerReplyAt ? (
                                <Badge className="bg-green-100 text-green-800">Replied</Badge>
                              ) : (
                                <Badge variant="secondary">Awaiting reply</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedLeadId(thread.leadId);
                                    setViewMode('compose');
                                    setChannel('sms');
                                    composeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }}
                                >
                                  Open
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSmsBody(thread.lastMessage?.body ?? '');
                                    setSelectedLeadId(thread.leadId);
                                    setViewMode('compose');
                                    setChannel('sms');
                                    composeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }}
                                >
                                  Reuse
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <MetricTile title="Sent Today" value={String(metrics?.sentToday ?? 0)} icon={Send} />
          <MetricTile title="Sent Month" value={String(metrics?.sentThisMonth ?? 0)} icon={MessageSquare} />
          <MetricTile title="Reply Rate" value={`${((metrics?.replyRate ?? 0) * 100).toFixed(1)}%`} icon={Reply} />
          <MetricTile title="Opt-out" value={`${((metrics?.optOutRate ?? 0) * 100).toFixed(1)}%`} icon={Ban} />
          <MetricTile title="Booked via SMS" value={String(metrics?.bookedViaSms ?? 0)} icon={Calendar} />
          <MetricTile title="Failed" value={String(metrics?.failedDelivery ?? 0)} icon={AlertTriangle} />
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricTile title="Active Conversations" value={String(metrics?.activeConversations ?? 0)} icon={Users} />
          <MetricTile title="Waiting Reply" value={String(metrics?.waitingForReply ?? 0)} icon={Clock3} />
          <MetricTile title="Need Takeover" value={String(metrics?.requiringTakeover ?? 0)} icon={CheckCircle2} />
        </section>

        <Card className="rounded-2xl border-indigo-200/60 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Campaign History & Inbox</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Real-time delivery history with search and filtering.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Search name, phone, email"
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  className="w-[260px]"
                />
                <Button variant="outline" onClick={() => loadThreads(threadSearch)} disabled={loadingThreads}>
                  {loadingThreads ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Pipeline Status</TableHead>
                    <TableHead>Last Message</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead>Reply State</TableHead>
                    <TableHead className="w-[120px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {threads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        {loadingThreads ? 'Loading conversations...' : 'No active conversations found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    threads.map((thread) => (
                      <TableRow key={thread.id}>
                        <TableCell>
                          <div className="font-medium">
                            {thread.lead.firstName} {thread.lead.lastName}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{thread.lead.status}</Badge>
                            {thread.lead.smsAutomationStage ? (
                              <Badge variant="secondary">{thread.lead.smsAutomationStage}</Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[360px]">
                          {thread.lastMessage ? (
                            <span className="text-muted-foreground">
                              {thread.lastMessage.direction === 'INBOUND' ? 'Lead: ' : 'Team: '}
                              {thread.lastMessage.body}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No messages yet</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDateTime(thread.lastMessageAt ?? thread.lastMessage?.createdAt)}</TableCell>
                        <TableCell>
                          {thread.customerReplyAt ? (
                            <Badge className="bg-green-100 text-green-800">Replied</Badge>
                          ) : (
                            <Badge variant="secondary">Awaiting reply</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedLeadId(thread.leadId);
                            }}
                          >
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-indigo-200/60 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Message Templates</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ready-to-send templates for onboarding, reminders, and follow-ups.
                </p>
              </div>
              <Button size="sm" onClick={openCreateTemplate}>
                + Create template
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
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
                  {templates.map((tpl) => (
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
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => applyTemplate(tpl.id)}>Use</Button>
                          <Button size="sm" variant="ghost" onClick={() => openEditTemplate(tpl.id)}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTemplateId ? 'Edit template' : 'Create template'}</DialogTitle>
              <DialogDescription>
                Define message content and variables. Use comma-separated variable keys.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Quick variables</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {variableTokens.map((token) => (
                    <button
                      key={`tpl-${token}`}
                      type="button"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', token)}
                      onClick={() => {
                        setActiveEditor('template');
                        insertVariableToken(token);
                      }}
                      className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-muted"
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-body">Body</Label>
                <Textarea
                  id="template-body"
                  ref={templateBodyRef}
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  onFocus={() => setActiveEditor('template')}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleVariableDrop(e, 'template')}
                  placeholder="Template body"
                  className="min-h-[110px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-vars">Variables</Label>
                <Input
                  id="template-vars"
                  value={templateVars}
                  onChange={(e) => setTemplateVars(e.target.value)}
                  placeholder="leadName, repName, time"
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <p className="text-sm text-muted-foreground">Template active</p>
                <Switch checked={templateActive} onCheckedChange={setTemplateActive} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveTemplate} disabled={!templateName.trim() || !templateBody.trim()}>
                {editingTemplateId ? 'Save changes' : 'Create template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function MetricTile({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof MessageSquare;
}) {
  return (
    <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-br from-white to-indigo-50/30 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <div className="rounded-lg border border-white/70 bg-white/70 p-2">
          <Icon className="h-4 w-4 text-indigo-700" />
        </div>
      </div>
    </div>
  );
}
