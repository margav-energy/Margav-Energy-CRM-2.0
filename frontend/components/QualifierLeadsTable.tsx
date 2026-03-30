import { useState, useMemo } from 'react';
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

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'QUALIFYING', label: 'Sent to Qualify' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'APPOINTMENT_SET', label: 'Appointment Set' },
  { value: 'QUALIFIER_CALLBACK', label: 'Call Back' },
  { value: 'NO_CONTACT', label: 'No Contact' },
  { value: 'NOT_INTERESTED', label: 'Blowout' },
];

interface QualifierLeadsTableProps {
  leads: QualifierLead[];
  loading?: boolean;
  onUpdated?: () => void;
}

export function QualifierLeadsTable({ leads, loading = false, onUpdated }: QualifierLeadsTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
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
      const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  const formatDate = (dateStr: string | undefined) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '—';

  const formatStatus = (status: string) => status.replace(/_/g, ' ');

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 shadow-xl">
        <CardHeader className="border-b bg-gradient-to-r from-slate-100/80 to-slate-50/80">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
            All Leads
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Search and filter leads. Click a row or View to open details and qualify.
          </p>
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
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Qualifier</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20"></TableHead>
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
                      No leads match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
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
                      <TableCell>
                        <Badge variant="outline">{formatStatus(lead.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.assignedAgent?.fullName || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.assignedQualifier?.fullName || '—'}
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
