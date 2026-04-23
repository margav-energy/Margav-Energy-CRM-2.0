import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { Search, Eye } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { LeadDetailSheet } from './admin/LeadDetailSheet';
import type { QualifierLead } from './QualifierKanban';

const PAGE_SIZE = 50;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'QUALIFYING', label: 'Sent to Qualify' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'APPOINTMENT_SET', label: 'Appointment Set' },
  { value: 'QUALIFIER_CALLBACK', label: 'Call Back' },
  { value: 'NO_CONTACT', label: 'No Contact' },
  { value: 'NOT_INTERESTED', label: 'Blowout' },
];

function formatProductLine(pl: string | null | undefined): string {
  if (pl === 'SOLAR') return 'Solar';
  if (pl === 'HEATING') return 'Heating';
  return '—';
}

function statusPillClass(status: string | undefined): string {
  const s = status ?? '';
  const map: Record<string, string> = {
    NEW: 'bg-slate-100 text-slate-800 border-slate-200/80',
    CONTACTED: 'bg-sky-100 text-sky-900 border-sky-200/80',
    INTERESTED: 'bg-emerald-100 text-emerald-900 border-emerald-200/80',
    NOT_INTERESTED: 'bg-red-100 text-red-900 border-red-200/80',
    DEPOSITION: 'bg-orange-100 text-orange-900 border-orange-200/80',
    QUALIFYING: 'bg-amber-100 text-amber-950 border-amber-200/80',
    QUALIFIED: 'bg-green-100 text-green-900 border-green-200/80',
    SOLD: 'bg-amber-100 text-amber-950 border-amber-300/80',
    NOT_QUALIFIED: 'bg-neutral-200 text-neutral-800 border-neutral-300/80',
    APPOINTMENT_SET: 'bg-indigo-100 text-indigo-900 border-indigo-200/80',
    NO_CONTACT: 'bg-zinc-200 text-zinc-800 border-zinc-300/80',
    QUALIFIER_CALLBACK: 'bg-violet-100 text-violet-900 border-violet-200/80',
  };
  return map[s] ?? 'bg-muted text-muted-foreground border-border';
}

interface QualifierLeadsTableProps {
  leads: QualifierLead[];
  loading?: boolean;
  onUpdated?: () => void;
  title?: string;
  subtitle?: string;
  /** Show Source column (e.g. Rattle / Leadwise) */
  showSource?: boolean;
  /** Colored pill chips vs outline badge */
  statusStyle?: 'badge' | 'pill';
  /** Hide assigned agent column (e.g. sheet pipeline where agent is not meaningful) */
  showAgent?: boolean;
  /** When Source column is shown, add a source filter (Rattle / Leadwise / all) */
  showSourceFilter?: boolean;
  /** Hide status dropdown (e.g. queue view where status is fixed) */
  hideStatusFilter?: boolean;
}

export function QualifierLeadsTable({
  leads,
  loading = false,
  onUpdated,
  title = 'All Leads',
  subtitle = 'Search and filter leads. Click a row or View to open details and qualify.',
  showSource = false,
  statusStyle = 'badge',
  showAgent = true,
  showSourceFilter = false,
  hideStatusFilter = false,
}: QualifierLeadsTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const filteredLeads = useMemo(() => {
    const term = search.toLowerCase().trim();
    return leads.filter((lead) => {
      const name = `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.toLowerCase();
      const matchesSearch =
        !term ||
        name.includes(term) ||
        (lead.phone ?? '').includes(term) ||
        (lead.email ?? '').toLowerCase().includes(term);
      const matchesStatus = hideStatusFilter || statusFilter === 'all' || lead.status === statusFilter;
      const src = lead.source ?? '';
      const matchesSource =
        !showSourceFilter || sourceFilter === 'all' || src === sourceFilter;
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [leads, search, statusFilter, sourceFilter, showSourceFilter, hideStatusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sourceFilter, leads]);

  const totalLeads = leads.length;
  const filteredCount = filteredLeads.length;
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE) || 1);

  const pagedLeads = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, page]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const isFiltered =
    search.trim() !== '' ||
    (!hideStatusFilter && statusFilter !== 'all') ||
    (showSourceFilter && sourceFilter !== 'all');

  const formatDate = (dateStr: string | undefined) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '—';

  const formatStatus = (status: string) => status.replace(/_/g, ' ');

  const colCount = 8 + (showSource ? 1 : 0) + (showAgent ? 1 : 0);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 shadow-xl">
        <CardHeader className="border-b bg-gradient-to-r from-slate-100/80 to-slate-50/80">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            {title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {!hideStatusFilter ? (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {showSourceFilter && showSource ? (
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="Rattle">Rattle</SelectItem>
                  <SelectItem value="Leadwise">Leadwise</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground mb-3" aria-live="polite">
            {loading ? (
              'Loading…'
            ) : isFiltered ? (
              <>
                Showing{' '}
                <span className="font-semibold tabular-nums text-foreground">{filteredCount}</span>
                {' of '}
                <span className="tabular-nums">{totalLeads}</span> lead{totalLeads === 1 ? '' : 's'}
              </>
            ) : (
              <>
                <span className="font-semibold tabular-nums text-foreground">{totalLeads}</span> lead
                {totalLeads === 1 ? '' : 's'}
              </>
            )}
          </p>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Product</TableHead>
                  {showSource ? <TableHead>Source</TableHead> : null}
                  <TableHead>Status</TableHead>
                  {showAgent ? <TableHead>Agent</TableHead> : null}
                  <TableHead>Qualifier / qualified by</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={colCount} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colCount} className="h-24 text-center text-muted-foreground">
                      No leads match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <TableCell className="font-medium">
                        {lead.firstName} {lead.lastName}
                      </TableCell>
                      <TableCell>{lead.phone || '—'}</TableCell>
                      <TableCell>{lead.email || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatProductLine(lead.productLine)}
                      </TableCell>
                      {showSource ? (
                        <TableCell className="text-muted-foreground">
                          {lead.source || '—'}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        {statusStyle === 'pill' ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                              statusPillClass(lead.status)
                            )}
                          >
                            {formatStatus(lead.status ?? '')}
                          </span>
                        ) : (
                          <Badge variant="outline">{formatStatus(lead.status)}</Badge>
                        )}
                      </TableCell>
                      {showAgent ? (
                        <TableCell className="text-muted-foreground">
                          {lead.assignedAgent?.fullName || '—'}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-muted-foreground">
                        {lead.qualifiedByQualifier?.fullName ??
                          lead.assignedQualifier?.fullName ??
                          '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(lead.createdAt)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setSelectedLeadId(lead.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && filteredCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                Showing{' '}
                <span className="font-medium tabular-nums text-foreground">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredCount)}
                </span>{' '}
                of <span className="tabular-nums">{filteredCount}</span> matching
                {pageCount > 1 ? (
                  <span className="text-muted-foreground"> · Page {page} of {pageCount}</span>
                ) : null}
              </p>
              {pageCount > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <LeadDetailSheet
        leadId={selectedLeadId}
        onClose={() => setSelectedLeadId(null)}
        onUpdated={() => onUpdated?.()}
      />
    </div>
  );
}
