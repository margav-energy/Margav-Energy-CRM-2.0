import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AgentLeadForm } from './AgentLeadForm';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { QualifierSummaryCard } from './QualifierSummaryCard';
import { Users, Phone, Calendar, TrendingUp, Search, Bell, X } from 'lucide-react';
import { getLeads, getTasks, getMe } from '../lib/api';

interface AgentLead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  status: string;
  source?: string;
  assignedAgent?: { fullName?: string };
  createdAt?: string;
  addressLine1?: string | null;
  city?: string | null;
  postcode?: string | null;
  notes?: string | null;
}

const STATUS_DISPLAY: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  NOT_INTERESTED: 'Not Interested',
  DEPOSITION: 'Deposition',
  QUALIFYING: 'Qualifying',
  QUALIFIED: 'Qualified',
  SOLD: 'Sold',
  NOT_QUALIFIED: 'Not Qualified',
  APPOINTMENT_SET: 'Appointment Set',
  NO_CONTACT: 'No Contact',
  QUALIFIER_CALLBACK: 'Callback',
};

function formatStatus(status: string): string {
  return STATUS_DISPLAY[status] ?? status?.replace(/_/g, ' ') ?? '—';
}

function isToday(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AgentDashboard() {
  const [leads, setLeads] = useState<AgentLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<AgentLead | null>(null);
  const [callbackDueTasks, setCallbackDueTasks] = useState<Array<{ id: string; title: string; dueDate: string; lead?: { firstName: string; lastName: string } | null }>>([]);
  const [showNewLeadForm, setShowNewLeadForm] = useState(false);
  const [showLeadFormForExisting, setShowLeadFormForExisting] = useState(false);
  const [openWithCallback, setOpenWithCallback] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [tablePage, setTablePage] = useState(1);

  const LEADS_PAGE_SIZE = 50;

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLeads({ pageSize: 500 });
      setLeads((res.items as AgentLead[]) ?? []);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        const res = await getTasks({
          assignedToUserId: me.id,
          pageSize: 50,
        });
        const now = new Date();
        const due = (res.items ?? []).filter(
          (t) =>
            (t.status === 'PENDING' || t.status === 'OVERDUE') &&
            new Date(t.dueDate) <= now
        );
        if (!cancelled) setCallbackDueTasks(due);
      } catch {
        if (!cancelled) setCallbackDueTasks([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) => {
        const name = `${lead.firstName} ${lead.lastName}`.toLowerCase();
        const matchesSearch =
          !searchTerm.trim() ||
          name.includes(searchTerm.toLowerCase()) ||
          (lead.phone ?? '').includes(searchTerm) ||
          (lead.email ?? '').toLowerCase().includes(searchTerm.toLowerCase());
        const displayStatus = formatStatus(lead.status);
        const matchesStatus = statusFilter === 'all' || displayStatus === statusFilter || lead.status === statusFilter;
        const matchesSource = sourceFilter === 'all' || (lead.source ?? '') === sourceFilter;
        return matchesSearch && matchesStatus && matchesSource;
      }),
    [leads, searchTerm, statusFilter, sourceFilter]
  );

  const filteredCount = filteredLeads.length;
  const tablePageCount = Math.max(1, Math.ceil(filteredCount / LEADS_PAGE_SIZE) || 1);

  const pagedAgentLeads = useMemo(() => {
    const start = (tablePage - 1) * LEADS_PAGE_SIZE;
    return filteredLeads.slice(start, start + LEADS_PAGE_SIZE);
  }, [filteredLeads, tablePage]);

  useEffect(() => {
    setTablePage(1);
  }, [searchTerm, statusFilter, sourceFilter, leads]);

  useEffect(() => {
    if (tablePage > tablePageCount) setTablePage(tablePageCount);
  }, [tablePage, tablePageCount]);

  const sources = Array.from(new Set(leads.map((l) => l.source).filter(Boolean))) as string[];
  const newToday = leads.filter((l) => isToday(l.createdAt)).length;
  const callsPending = leads.filter((l) => ['NEW', 'CONTACTED'].includes(l.status)).length;
  const interested = leads.filter((l) => l.status === 'INTERESTED').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-100 text-blue-800';
      case 'CONTACTED':
        return 'bg-yellow-100 text-yellow-800';
      case 'INTERESTED':
        return 'bg-green-100 text-green-800';
      case 'NOT_INTERESTED':
        return 'bg-red-100 text-red-800';
      case 'DEPOSITION':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Callback Due Banner */}
      {callbackDueTasks.length > 0 && !bannerDismissed && (
        <div className="relative flex items-center gap-3 rounded-xl border-2 border-amber-200/90 bg-gradient-to-br from-amber-50 via-orange-50/80 to-amber-50 px-4 py-3 text-amber-800 shadow-md shadow-amber-100/30">
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-xl" />
          <Bell className="h-5 w-5 shrink-0 text-amber-600 relative z-10" />
          <div className="flex-1 relative z-10">
            <p className="font-medium">
              {callbackDueTasks.length} callback{callbackDueTasks.length !== 1 ? 's' : ''} due
            </p>
            <p className="text-sm text-amber-700">
              {callbackDueTasks.slice(0, 3).map((t) =>
                t.lead ? `${t.lead.firstName} ${t.lead.lastName}` : t.title
              ).join(', ')}
              {callbackDueTasks.length > 3 && ` +${callbackDueTasks.length - 3} more`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0 text-amber-700 hover:text-amber-900 hover:bg-amber-200/50 relative z-10"
            onClick={() => setBannerDismissed(true)}
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QualifierSummaryCard
          title="Total Leads"
          value={leads.length}
          icon={Users}
          change={`${newToday} new today`}
          changeType={newToday > 0 ? 'positive' : 'neutral'}
          variant="emerald"
        />
        <QualifierSummaryCard
          title="New Leads Today"
          value={newToday}
          icon={TrendingUp}
          change={newToday > 0 ? 'From CRM' : 'No new leads today'}
          changeType={newToday > 0 ? 'positive' : 'neutral'}
          variant="amber"
        />
        <QualifierSummaryCard
          title="Calls Pending"
          value={callsPending}
          icon={Phone}
          change={callsPending > 0 ? 'Require follow-up' : 'All contacted'}
          changeType={callsPending > 0 ? 'neutral' : 'positive'}
          variant="blue"
        />
        <QualifierSummaryCard
          title="Interested Leads"
          value={interested}
          icon={Calendar}
          change="Ready for qualification"
          changeType="neutral"
          variant="violet"
        />
      </div>

      {/* Filters and Search */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-gradient-to-br from-white via-slate-50/90 to-gray-50/70 shadow-md shadow-slate-100/30">
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-2xl" />
        <div className="relative bg-gradient-to-r from-slate-500 via-gray-500 to-slate-600 text-white px-6 py-4 border-b border-white/30">
          <div className="flex flex-row items-center justify-between">
            <h3 className="font-semibold text-lg">Lead Management</h3>
            <Button onClick={() => setShowNewLeadForm(true)} className="bg-white/20 hover:bg-white/30 text-white border-white/40">
              New Lead
            </Button>
          </div>
        </div>
        <div className="relative p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search leads by name, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Contacted">Contacted</SelectItem>
                <SelectItem value="Interested">Interested</SelectItem>
                <SelectItem value="Not Interested">Not Interested</SelectItem>
                <SelectItem value="Deposition">Deposition</SelectItem>
                <SelectItem value="Qualified">Qualified</SelectItem>
                <SelectItem value="Appointment Set">Appointment Set</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {sources.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                {sources.length === 0 && (
                  <>
                    <SelectItem value="BLC">BLC</SelectItem>
                    <SelectItem value="Rattle">Rattle</SelectItem>
                    <SelectItem value="Leadwise">Leadwise</SelectItem>
                    <SelectItem value="Website">Website</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="Cold Call">Cold Call</SelectItem>
                    <SelectItem value="Social Media">Social Media</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Leads Table */}
          <div className="relative rounded-xl border-2 border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-gray-50/50 shadow-md overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/30 to-transparent pointer-events-none rounded-t-xl" />
            <Table>
              <TableHeader className="bg-gradient-to-r from-slate-500 via-gray-500 to-slate-600 [&_tr]:border-0">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-white font-semibold">Name</TableHead>
                  <TableHead className="text-white font-semibold">Phone</TableHead>
                  <TableHead className="text-white font-semibold">Email</TableHead>
                  <TableHead className="text-white font-semibold">Status</TableHead>
                  <TableHead className="text-white font-semibold">Agent Name</TableHead>
                  <TableHead className="text-white font-semibold">Source</TableHead>
                  <TableHead className="text-white font-semibold">Date and Time</TableHead>
                  <TableHead className="text-white font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      No leads match your filters. Import your dataset or add leads manually.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedAgentLeads.map((lead) => (
                    <TableRow key={lead.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        {lead.firstName} {lead.lastName}
                      </TableCell>
                      <TableCell>{lead.phone}</TableCell>
                      <TableCell>{lead.email}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(lead.status)}>
                          {formatStatus(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.assignedAgent?.fullName ?? '—'}</TableCell>
                      <TableCell>{lead.source || '—'}</TableCell>
                      <TableCell>{formatDateTime(lead.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            title="Schedule Callback"
                            onClick={() => {
                              setSelectedLead(lead);
                              setOpenWithCallback(true);
                              setShowLeadFormForExisting(true);
                            }}
                            disabled={
                              ['QUALIFYING', 'QUALIFIED', 'SOLD', 'APPOINTMENT_SET', 'QUALIFIER_CALLBACK', 'NO_CONTACT', 'NOT_INTERESTED'].includes(lead.status)
                            }
                          >
                            📞
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 w-8 p-0"
                            style={{
                              backgroundColor: 'var(--energy-green-1)',
                              color: 'white',
                              borderColor: 'var(--energy-green-1)',
                            }}
                            title="Complete Lead Sheet & Send to Qualifier"
                            onClick={() => {
                              setSelectedLead(lead);
                              setOpenWithCallback(false);
                              setShowLeadFormForExisting(true);
                            }}
                            disabled={
                              ['QUALIFYING', 'QUALIFIED', 'SOLD', 'APPOINTMENT_SET', 'QUALIFIER_CALLBACK', 'NO_CONTACT', 'NOT_INTERESTED'].includes(lead.status)
                            }
                          >
                            ✓
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {!loading && filteredCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  Showing{' '}
                  <span className="font-medium tabular-nums text-foreground">
                    {(tablePage - 1) * LEADS_PAGE_SIZE + 1}–{Math.min(tablePage * LEADS_PAGE_SIZE, filteredCount)}
                  </span>{' '}
                  of {filteredCount}
                  {tablePageCount > 1 ? (
                    <span className="text-muted-foreground"> · Page {tablePage} of {tablePageCount}</span>
                  ) : null}
                </p>
                {tablePageCount > 1 ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={tablePage <= 1}
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={tablePage >= tablePageCount}
                      onClick={() => setTablePage((p) => Math.min(tablePageCount, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <AgentLeadForm
        open={showNewLeadForm}
        onClose={() => setShowNewLeadForm(false)}
        onSaved={() => {
          setShowNewLeadForm(false);
          loadLeads();
        }}
      />

      <AgentLeadForm
        open={showLeadFormForExisting}
        lead={selectedLead ?? undefined}
        openCallbackOnMount={openWithCallback}
        onClose={() => {
          setShowLeadFormForExisting(false);
          setSelectedLead(null);
          setOpenWithCallback(false);
        }}
        onSaved={() => {
          setShowLeadFormForExisting(false);
          setSelectedLead(null);
          setOpenWithCallback(false);
          loadLeads();
        }}
      />
    </div>
  );
}
