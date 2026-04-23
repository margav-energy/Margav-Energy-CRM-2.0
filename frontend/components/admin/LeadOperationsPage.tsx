import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Search, MoreHorizontal, UserPlus, Flag, Pause, Eye, RefreshCw, Users, GitMerge, ListTree, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { deleteAdminLead, getAdminLeads, getAdminUsers, getLeadById, mergeAdminLeads, updateLead, updateLeadStatus } from '../../lib/api';
import type { LeadViewType, AdminLead } from '../../lib/admin-types';
import { LeadStatusPill, ALL_LEAD_STATUSES, formatLeadStatusLabel } from '../../lib/leadStatusPill';
import { LeadOverviewDialog } from './LeadOverviewDialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

const VIEW_TABS: { value: LeadViewType; label: string }[] = [
  { value: 'all', label: 'All Leads' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'duplicates', label: 'Duplicates' },
  { value: 'no-activity', label: 'No Recent Activity' },
];

type StaffUser = { id: string; fullName: string; role: string };

const UNASSIGNED = '__none__';

export function LeadOperationsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeView, setActiveView] = useState<LeadViewType>('all');
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const [staff, setStaff] = useState<StaffUser[]>([]);

  const [overviewLeadId, setOverviewLeadId] = useState<string | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overviewTab, setOverviewTab] = useState<'details' | 'timeline'>('details');

  const [statusLead, setStatusLead] = useState<AdminLead | null>(null);
  const [pendingStatus, setPendingStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  const [reassignLead, setReassignLead] = useState<AdminLead | null>(null);
  const [reassignAgent, setReassignAgent] = useState(UNASSIGNED);
  const [reassignQualifier, setReassignQualifier] = useState(UNASSIGNED);
  const [reassignField, setReassignField] = useState(UNASSIGNED);
  const [reassignSaving, setReassignSaving] = useState(false);

  const [duplicateLead, setDuplicateLead] = useState<AdminLead | null>(null);
  const [duplicateMasterId, setDuplicateMasterId] = useState('');
  const [dupCanonicalLabel, setDupCanonicalLabel] = useState('');
  const [dupSearchQuery, setDupSearchQuery] = useState('');
  const [dupSearchResults, setDupSearchResults] = useState<AdminLead[]>([]);
  const [dupSearchLoading, setDupSearchLoading] = useState(false);
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const [mergeKeepLead, setMergeKeepLead] = useState<AdminLead | null>(null);
  const [mergePickLead, setMergePickLead] = useState<AdminLead | null>(null);
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  const [mergeSearchResults, setMergeSearchResults] = useState<AdminLead[]>([]);
  const [mergeSearchLoading, setMergeSearchLoading] = useState(false);
  const [mergeSaving, setMergeSaving] = useState(false);

  const [leadToDelete, setLeadToDelete] = useState<AdminLead | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const reload = useCallback(() => setRefreshTick((t) => t + 1), []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    getAdminUsers()
      .then((u) => {
        if (Array.isArray(u)) setStaff(u as StaffUser[]);
        else setStaff([]);
      })
      .catch(() => setStaff([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    getAdminLeads({
      view: activeView,
      search: debouncedSearch || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      source: sourceFilter !== 'all' ? sourceFilter : undefined,
    })
      .then((res) => {
        const items = res && typeof res === 'object' && 'items' in res && Array.isArray((res as { items: unknown }).items)
          ? ((res as { items: AdminLead[] }).items)
          : [];
        setLeads(items);
      })
      .catch((e) => {
        setLeads([]);
        toast.error(e instanceof Error ? e.message : 'Could not load leads');
      })
      .finally(() => setLoading(false));
  }, [activeView, debouncedSearch, statusFilter, sourceFilter, refreshTick]);

  const filteredLeads = leads;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const openOverview = (lead: AdminLead, tab: 'details' | 'timeline' = 'details') => {
    setOverviewLeadId(lead.id);
    setOverviewTab(tab);
    setOverviewOpen(true);
  };

  const openChangeStatus = (lead: AdminLead) => {
    setStatusLead(lead);
    setPendingStatus(lead.status);
    setStatusNote('');
  };

  const openReassign = async (lead: AdminLead) => {
    setReassignLead(lead);
    try {
      const full = (await getLeadById(lead.id)) as Record<string, unknown>;
      setReassignAgent(
        full.assignedAgentId != null ? String(full.assignedAgentId) : UNASSIGNED,
      );
      setReassignQualifier(
        full.assignedQualifierId != null ? String(full.assignedQualifierId) : UNASSIGNED,
      );
      setReassignField(
        full.assignedFieldSalesRepId != null ? String(full.assignedFieldSalesRepId) : UNASSIGNED,
      );
    } catch {
      setReassignAgent(lead.assignedAgentId ?? UNASSIGNED);
      setReassignQualifier(lead.assignedQualifierId ?? UNASSIGNED);
      setReassignField(lead.assignedFieldSalesRepId ?? UNASSIGNED);
    }
  };

  const agents = staff.filter((u) => u.role === 'AGENT');
  const qualifiers = staff.filter((u) => u.role === 'QUALIFIER');
  const fieldReps = staff.filter((u) => u.role === 'FIELD_SALES');

  const saveStatus = async () => {
    if (!statusLead || !pendingStatus) return;
    setStatusSaving(true);
    try {
      await updateLeadStatus(statusLead.id, pendingStatus, statusNote.trim() || undefined);
      toast.success('Status updated');
      setStatusLead(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update status');
    } finally {
      setStatusSaving(false);
    }
  };

  const saveReassign = async () => {
    if (!reassignLead) return;
    setReassignSaving(true);
    try {
      await updateLead(reassignLead.id, {
        assignedAgentId: reassignAgent === UNASSIGNED ? null : reassignAgent,
        assignedQualifierId: reassignQualifier === UNASSIGNED ? null : reassignQualifier,
        assignedFieldSalesRepId: reassignField === UNASSIGNED ? null : reassignField,
      });
      toast.success('Assignments updated');
      setReassignLead(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update assignments');
    } finally {
      setReassignSaving(false);
    }
  };

  const togglePriority = async (lead: AdminLead) => {
    try {
      await updateLead(lead.id, { priority: !lead.priority });
      toast.success(lead.priority ? 'Priority removed' : 'Marked as priority');
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update priority');
    }
  };

  const toggleSmsPause = async (lead: AdminLead) => {
    try {
      await updateLead(lead.id, { smsAutomationPaused: !lead.smsAutomationPaused });
      toast.success(
        lead.smsAutomationPaused ? 'SMS automation resumed for this lead' : 'SMS automation paused for this lead',
      );
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update SMS automation');
    }
  };

  useEffect(() => {
    if (!duplicateLead) return;
    const q = dupSearchQuery.trim();
    if (q.length < 2) {
      setDupSearchResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      setDupSearchLoading(true);
      getAdminLeads({ view: 'all', search: q, pageSize: 15 })
        .then((res) => {
          const items = Array.isArray(res?.items) ? (res.items as AdminLead[]) : [];
          setDupSearchResults(items.filter((l) => l.id !== duplicateLead.id));
        })
        .catch(() => setDupSearchResults([]))
        .finally(() => setDupSearchLoading(false));
    }, 350);
    return () => window.clearTimeout(t);
  }, [dupSearchQuery, duplicateLead]);

  useEffect(() => {
    if (!mergeKeepLead) return;
    const q = mergeSearchQuery.trim();
    if (q.length < 2) {
      setMergeSearchResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      setMergeSearchLoading(true);
      getAdminLeads({ view: 'all', search: q, pageSize: 15 })
        .then((res) => {
          const items = Array.isArray(res?.items) ? (res.items as AdminLead[]) : [];
          setMergeSearchResults(items.filter((l) => l.id !== mergeKeepLead.id));
        })
        .catch(() => setMergeSearchResults([]))
        .finally(() => setMergeSearchLoading(false));
    }, 350);
    return () => window.clearTimeout(t);
  }, [mergeSearchQuery, mergeKeepLead]);

  const leadPickLabel = (l: AdminLead) =>
    `${l.firstName} ${l.lastName} · ${l.phone}${l.postcode ? ` · ${l.postcode}` : ''}`;

  const saveDuplicateLink = async () => {
    if (!duplicateLead) return;
    const raw = duplicateMasterId.trim();
    if (raw === duplicateLead.id) {
      toast.error('Canonical lead must be a different lead');
      return;
    }
    setDuplicateSaving(true);
    try {
      await updateLead(duplicateLead.id, { duplicateOfLeadId: raw ? raw : null });
      toast.success(raw ? 'This lead is now linked as a duplicate of the canonical lead' : 'Duplicate link cleared');
      setDuplicateLead(null);
      setDuplicateMasterId('');
      setDupCanonicalLabel('');
      setDupSearchQuery('');
      setDupSearchResults([]);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setDuplicateSaving(false);
    }
  };

  const saveMerge = async () => {
    if (!mergeKeepLead) return;
    const other = mergePickLead?.id;
    if (!other) {
      toast.error('Search and select the duplicate record to merge in');
      return;
    }
    if (other === mergeKeepLead.id) {
      toast.error('Choose a different lead to merge (not the same row)');
      return;
    }
    setMergeSaving(true);
    try {
      await mergeAdminLeads(mergeKeepLead.id, other);
      toast.success('Leads merged. The other record was removed.');
      setMergeKeepLead(null);
      setMergePickLead(null);
      setMergeSearchQuery('');
      setMergeSearchResults([]);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Merge failed');
    } finally {
      setMergeSaving(false);
    }
  };

  const confirmDeleteLead = async () => {
    if (!leadToDelete) return;
    setDeleteSaving(true);
    try {
      await deleteAdminLead(leadToDelete.id);
      toast.success('Lead deleted');
      setLeadToDelete(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(leadToDelete.id);
        return next;
      });
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete lead');
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-white via-background to-violet-50/30 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Lead Operations</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Full visibility and control over all leads. Bulk assign, change status, merge duplicates.
            </p>
          </div>
        </div>

        <Card className="rounded-2xl border-border/80">
          <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_160px]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, postcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatLeadStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="BLC">BLC</SelectItem>
                <SelectItem value="Rattle">Rattle</SelectItem>
                <SelectItem value="Leadwise">Leadwise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={activeView} onValueChange={(v) => setActiveView(v as LeadViewType)}>
            <TabsList className="flex-wrap h-auto">
              {VIEW_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Panel lives outside TabsContent: a single dynamic TabsContent breaks Radix (content often never shows). */}
          <div
            className="mt-4 space-y-4"
            role="tabpanel"
            id="lead-operations-panel"
            aria-label={`Leads: ${VIEW_TABS.find((t) => t.value === activeView)?.label ?? activeView}`}
          >
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-4 p-3 mb-4 rounded-lg bg-muted">
                  <span className="text-sm font-medium">{selectedIds.size} selected</span>
                  <Button size="sm" variant="outline">
                    <UserPlus className="h-4 w-4 mr-1" />
                    Bulk Assign
                  </Button>
                  <Button size="sm" variant="outline">
                    Bulk Status
                  </Button>
                  <Button size="sm" variant="outline">
                    <Flag className="h-4 w-4 mr-1" />
                    Mark Priority
                  </Button>
                  <Button size="sm" variant="outline">
                    <Pause className="h-4 w-4 mr-1" />
                    Pause Automation
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    Clear
                  </Button>
                </div>
              )}

              <div className="border rounded-lg overflow-x-auto bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Qualifier</TableHead>
                      <TableHead>Field Rep</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(lead.id)}
                            onCheckedChange={() => toggleSelect(lead.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => openOverview(lead, 'details')}
                            className="text-left font-medium hover:underline underline-offset-2 text-primary"
                          >
                            {lead.firstName} {lead.lastName}
                            {lead.priority && (
                              <span className="inline-flex" title="Priority">
                                <Flag className="inline h-3 w-3 ml-1 text-amber-500 fill-amber-500" aria-hidden />
                              </span>
                            )}
                          </button>
                          <div className="text-xs text-muted-foreground">
                            {lead.postcode}
                            {lead.duplicateOfLeadId && (
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Dup of {lead.duplicateOfLeadName ?? lead.duplicateOfLeadId.slice(0, 8) + '…'}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{lead.phone || '—'}</TableCell>
                        <TableCell>
                          <LeadStatusPill status={lead.status} />
                        </TableCell>
                        <TableCell>{lead.source || '—'}</TableCell>
                        <TableCell>{lead.assignedAgentName || '—'}</TableCell>
                        <TableCell>{lead.assignedQualifierName || '—'}</TableCell>
                        <TableCell>{lead.assignedFieldSalesRepName || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(lead.createdAt)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {lead.lastActivityAt ? formatDate(lead.lastActivityAt) : '—'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Lead actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 z-[100]">
                              <DropdownMenuItem
                                onSelect={() => queueMicrotask(() => openOverview(lead, 'details'))}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View overview
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => queueMicrotask(() => openChangeStatus(lead))}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Change status…
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => queueMicrotask(() => void openReassign(lead))}
                              >
                                <Users className="h-4 w-4 mr-2" />
                                Reassign…
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => queueMicrotask(() => openOverview(lead, 'timeline'))}
                              >
                                <ListTree className="h-4 w-4 mr-2" />
                                Activity timeline
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => queueMicrotask(() => void togglePriority(lead))}>
                                <Flag className="h-4 w-4 mr-2" />
                                {lead.priority ? 'Remove priority' : 'Mark priority'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => queueMicrotask(() => void toggleSmsPause(lead))}>
                                <Pause className="h-4 w-4 mr-2" />
                                {lead.smsAutomationPaused ? 'Resume SMS automation' : 'Pause SMS automation'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() =>
                                  queueMicrotask(() => {
                                    setDuplicateLead(lead);
                                    setDuplicateMasterId(lead.duplicateOfLeadId ?? '');
                                    setDupCanonicalLabel(
                                      lead.duplicateOfLeadId
                                        ? lead.duplicateOfLeadName ?? `Lead ${lead.duplicateOfLeadId.slice(0, 10)}…`
                                        : '',
                                    );
                                    setDupSearchQuery('');
                                    setDupSearchResults([]);
                                  })
                                }
                              >
                                <Flag className="h-4 w-4 mr-2" />
                                Flag duplicate…
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() =>
                                  queueMicrotask(() => {
                                    setMergeKeepLead(lead);
                                    setMergePickLead(null);
                                    setMergeSearchQuery('');
                                    setMergeSearchResults([]);
                                  })
                                }
                              >
                                <GitMerge className="h-4 w-4 mr-2" />
                                Merge another lead…
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => queueMicrotask(() => setLeadToDelete(lead))}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete…
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {loading && (
                <div className="py-6 text-center text-sm text-muted-foreground">Updating…</div>
              )}
              {!loading && filteredLeads.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">No leads match your filters.</div>
              )}
          </div>
        </CardContent>
      </Card>
      </div>

      <LeadOverviewDialog
        key={`${overviewLeadId ?? 'x'}-${overviewTab}`}
        leadId={overviewLeadId}
        open={overviewOpen && !!overviewLeadId}
        onOpenChange={(o) => {
          setOverviewOpen(o);
          if (!o) setOverviewLeadId(null);
        }}
        defaultTab={overviewTab}
      />

      <AlertDialog
        open={!!leadToDelete}
        onOpenChange={(o) => {
          if (!o) setLeadToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              {leadToDelete
                ? `This will permanently remove ${leadToDelete.firstName} ${leadToDelete.lastName} and related activity. This cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSaving}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => void confirmDeleteLead()}
              disabled={deleteSaving}
            >
              {deleteSaving ? 'Deleting…' : 'Delete lead'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!statusLead} onOpenChange={(o) => !o && setStatusLead(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change status</DialogTitle>
            <DialogDescription>
              Update pipeline status for{' '}
              {statusLead ? `${statusLead.firstName} ${statusLead.lastName}` : 'this lead'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="lead-status">Status</Label>
              <Select value={pendingStatus} onValueChange={setPendingStatus}>
                <SelectTrigger id="lead-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatLeadStatusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-note">Note (optional)</Label>
              <Textarea
                id="status-note"
                placeholder="Reason or context for the audit trail"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusLead(null)}>
              Cancel
            </Button>
            <Button onClick={saveStatus} disabled={statusSaving || !pendingStatus}>
              {statusSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reassignLead} onOpenChange={(o) => !o && setReassignLead(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reassign</DialogTitle>
            <DialogDescription>
              {reassignLead
                ? `Set agent, qualifier, and field sales for ${reassignLead.firstName} ${reassignLead.lastName}.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={reassignAgent} onValueChange={setReassignAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {agents.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Qualifier</Label>
              <Select value={reassignQualifier} onValueChange={setReassignQualifier}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {qualifiers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Field sales</Label>
              <Select value={reassignField} onValueChange={setReassignField}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {fieldReps.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignLead(null)}>
              Cancel
            </Button>
            <Button onClick={saveReassign} disabled={reassignSaving}>
              {reassignSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!duplicateLead}
        onOpenChange={(o) => {
          if (!o) {
            setDuplicateLead(null);
            setDuplicateMasterId('');
            setDupCanonicalLabel('');
            setDupSearchQuery('');
            setDupSearchResults([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Flag duplicate</DialogTitle>
            <DialogDescription>
              Search by <strong>name</strong>, <strong>phone</strong>, or <strong>email</strong> for the canonical lead you
              are keeping. This row stays; it points at the master record.
              {duplicateLead ? (
                <>
                  {' '}
                  Current row: {duplicateLead.firstName} {duplicateLead.lastName}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="dup-search">Find canonical lead</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dup-search"
                  placeholder="Type at least 2 characters…"
                  value={dupSearchQuery}
                  onChange={(e) => setDupSearchQuery(e.target.value)}
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
              {dupSearchLoading && <p className="text-xs text-muted-foreground">Searching…</p>}
              {!dupSearchLoading && dupSearchQuery.trim().length >= 2 && dupSearchResults.length === 0 && (
                <p className="text-xs text-muted-foreground">No matches. Try another phone or name.</p>
              )}
              {dupSearchResults.length > 0 && (
                <ul
                  className="max-h-44 overflow-y-auto rounded-md border border-border bg-muted/30 text-sm"
                  role="listbox"
                >
                  {dupSearchResults.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2.5 text-left hover:bg-accent hover:text-accent-foreground border-b border-border/40 last:border-0"
                        onClick={() => {
                          setDuplicateMasterId(l.id);
                          setDupCanonicalLabel(leadPickLabel(l));
                          setDupSearchQuery('');
                          setDupSearchResults([]);
                        }}
                      >
                        {leadPickLabel(l)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {(duplicateMasterId || dupCanonicalLabel) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <span>
                  <span className="text-muted-foreground">Canonical: </span>
                  <strong>
                    {dupCanonicalLabel ||
                      (duplicateMasterId.length > 24
                        ? `${duplicateMasterId.slice(0, 10)}…${duplicateMasterId.slice(-6)}`
                        : duplicateMasterId)}
                  </strong>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setDuplicateMasterId('');
                    setDupCanonicalLabel('');
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              To remove the link, clear the selection above and save.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDuplicateLead(null);
                setDuplicateMasterId('');
                setDupCanonicalLabel('');
                setDupSearchQuery('');
                setDupSearchResults([]);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveDuplicateLink} disabled={duplicateSaving}>
              {duplicateSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!mergeKeepLead}
        onOpenChange={(o) => {
          if (!o) {
            setMergeKeepLead(null);
            setMergePickLead(null);
            setMergeSearchQuery('');
            setMergeSearchResults([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Merge leads</DialogTitle>
            <DialogDescription>
              This row is <strong>kept</strong>. Search for the <strong>other</strong> duplicate record by name or
              phone—its appointments, tasks, SMS, and history move here, then that record is deleted.
              {mergeKeepLead ? (
                <>
                  {' '}
                  Keeping: {mergeKeepLead.firstName} {mergeKeepLead.lastName}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="merge-search">Find lead to merge in (will be removed)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="merge-search"
                  placeholder="Type at least 2 characters…"
                  value={mergeSearchQuery}
                  onChange={(e) => setMergeSearchQuery(e.target.value)}
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
              {mergeSearchLoading && <p className="text-xs text-muted-foreground">Searching…</p>}
              {!mergeSearchLoading && mergeSearchQuery.trim().length >= 2 && mergeSearchResults.length === 0 && (
                <p className="text-xs text-muted-foreground">No matches.</p>
              )}
              {mergeSearchResults.length > 0 && (
                <ul className="max-h-44 overflow-y-auto rounded-md border border-border bg-muted/30 text-sm">
                  {mergeSearchResults.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2.5 text-left hover:bg-accent hover:text-accent-foreground border-b border-border/40 last:border-0"
                        onClick={() => {
                          setMergePickLead(l);
                          setMergeSearchQuery('');
                          setMergeSearchResults([]);
                        }}
                      >
                        {leadPickLabel(l)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {mergePickLead && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Will merge &amp; remove: </span>
                <strong>{leadPickLabel(mergePickLead)}</strong>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-7"
                  onClick={() => setMergePickLead(null)}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMergeKeepLead(null);
                setMergePickLead(null);
                setMergeSearchQuery('');
                setMergeSearchResults([]);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={saveMerge} disabled={mergeSaving || !mergePickLead}>
              {mergeSaving ? 'Merging…' : 'Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
