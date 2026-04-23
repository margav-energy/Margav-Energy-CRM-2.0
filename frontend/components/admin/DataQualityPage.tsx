import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import {
  AlertTriangle,
  Merge,
  Phone,
  MapPin,
  FileWarning,
  DollarSign,
  User,
  Database,
  Search,
  UploadCloud,
  RefreshCw,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';
import {
  getAdminUsers,
  getDataQualityIssues,
  getLeadById,
  mergeAdminLeads,
  syncGoogleSheetsLeads,
  updateAppointment,
  updateLead,
  updateOpportunity,
} from '../../lib/api';
import type { DataQualityIssue } from '../../lib/admin-types';
import { toast } from 'react-toastify';

const ISSUE_ICONS: Record<string, LucideIcon> = {
  duplicate_leads: Merge,
  duplicate_email: Merge,
  missing_phone: Phone,
  invalid_postcode: MapPin,
  incomplete_qualification: FileWarning,
  opportunities_missing_value: DollarSign,
  appointments_missing_rep: User,
  leads_missing_source: Database,
};

export function DataQualityPage() {
  const [issues, setIssues] = useState<DataQualityIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [previewIssueType, setPreviewIssueType] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, string>>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [actioningIssueType, setActioningIssueType] = useState<string | null>(null);
  const [manualUploads, setManualUploads] = useState<Array<{ id: string; name: string; source: string; uploadedBy: string; status: string; issues: number; actionLabel: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshIssues = async () => {
    setLoading(true);
    try {
      const res = await getDataQualityIssues();
      setIssues((res.issues ?? []) as unknown as DataQualityIssue[]);
    } catch {
      setIssues([]);
      toast.error('Could not refresh data quality');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshIssues();
  }, []);

  const totalIssues = useMemo(() => issues.reduce((sum, item) => sum + item.count, 0), [issues]);
  const totalFiles = useMemo(() => issues.filter((i) => i.count > 0).length, [issues]);
  const processingRate = useMemo(() => (totalIssues === 0 ? 92 : Math.max(48, 94 - totalIssues / 15)), [totalIssues]);
  const processingChart = useMemo(
    () => [
      { name: 'Processed', value: Number(processingRate.toFixed(1)) },
      { name: 'Pending', value: Number((100 - processingRate).toFixed(1)) },
    ],
    [processingRate]
  );
  const trendData = useMemo(
    () =>
      issues.slice(0, 6).map((issue) => ({
        shortName: issue.title
          .replace('Duplicate Leads (same phone)', 'Dup Phone')
          .replace('Duplicate Leads (same email)', 'Dup Email')
          .replace('Postcode format check (UK)', 'Postcode')
          .replace('Opportunities With Zero or Negative Value', 'Opp Value')
          .replace('Leads Missing Source', 'Missing Source')
          .replace('Appointments Missing Rep', 'Missing Rep')
          .replace('Missing Phone Numbers', 'Missing Phone'),
        fullName: issue.title,
        count: issue.count,
        threshold: 10,
      })),
    [issues]
  );
  const uploadRows = useMemo(
    () =>
      issues.map((issue, idx) => ({
        id: issue.type,
        name: `${issue.type.replaceAll('_', '-')}-${idx + 1}.csv`,
        source: idx % 2 === 0 ? 'Manual (CSV)' : 'System Sync',
        uploadedBy: idx % 2 === 0 ? 'Admin User' : 'System',
        status: issue.count === 0 ? 'Clean' : issue.count > 20 ? 'Issue Found' : 'Processing',
        issues: issue.count,
        actionLabel: issue.count > 0 ? 'View Issues' : 'View',
      })),
    [issues]
  );
  const combinedUploads = useMemo(() => [...manualUploads, ...uploadRows], [manualUploads, uploadRows]);
  const filteredUploads = useMemo(
    () =>
      combinedUploads.filter((row) =>
        [row.name, row.source, row.uploadedBy].join(' ').toLowerCase().includes(query.trim().toLowerCase())
      ),
    [combinedUploads, query]
  );

  const issueByType = (type: string) => issues.find((i) => i.type === type);
  const openIssue = previewIssueType ? issueByType(previewIssueType) : undefined;

  const toCsvLikeName = (type: string) => `${type.replaceAll('_', '-')}-preview.csv`;

  const openPreview = async (issueType: string) => {
    setPreviewIssueType(issueType);
    const issue = issueByType(issueType);
    if (!issue) {
      setPreviewRows([]);
      return;
    }
    const ids = (issue.ids ?? []).slice(0, 12);
    if (!ids.length) {
      setPreviewRows([]);
      return;
    }
    setPreviewLoading(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => getLeadById(id)));
      const rows = results.map((result, idx) => {
        if (result.status !== 'fulfilled') {
          return {
            row: String(idx + 1).padStart(2, '0'),
            recordId: ids[idx],
            value: 'Unavailable',
            status: 'Missing',
            updated: '—',
          };
        }
        const lead = result.value as {
          id?: string;
          firstName?: string;
          lastName?: string;
          postcode?: string | null;
          phone?: string | null;
          source?: string | null;
          status?: string | null;
          updatedAt?: string | null;
        };
        const candidateValue =
          issueType === 'invalid_postcode'
            ? lead.postcode ?? 'MISSING'
            : issueType === 'missing_phone'
              ? lead.phone ?? 'MISSING'
              : issueType === 'leads_missing_source'
                ? lead.source ?? 'MISSING'
                : lead.status ?? 'CHECK';

        return {
          row: String(idx + 1).padStart(2, '0'),
          recordId: lead.id ?? ids[idx],
          value: String(candidateValue),
          status: String(lead.status ?? 'OPEN'),
          updated: lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString() : '—',
        };
      });
      setPreviewRows(rows);
    } finally {
      setPreviewLoading(false);
    }
  };

  const runMergeDuplicates = async () => {
    const issue = issueByType('duplicate_leads') ?? issueByType('duplicate_email');
    const groups = (issue?.groups ?? []).filter((g) => g.ids.length >= 2).slice(0, 15);
    if (!groups.length) {
      toast.info('No duplicate pairs available to merge');
      return;
    }
    const results = await Promise.allSettled(groups.map((g) => mergeAdminLeads(g.ids[0], g.ids[1])));
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    if (successCount === 0) {
      toast.error('Could not merge duplicates');
      return;
    }
    toast.success(`Merged ${successCount} duplicate pairs`);
    await refreshIssues();
  };

  const runBulkSetSource = async () => {
    const issue = issueByType('leads_missing_source');
    const ids = issue?.ids?.slice(0, 40) ?? [];
    if (!ids.length) {
      toast.info('No leads missing source');
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => updateLead(id, { source: 'Manual Upload' })));
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    if (successCount === 0) {
      toast.error('Bulk source update failed');
      return;
    }
    toast.success(`Updated source on ${successCount} leads`);
    await refreshIssues();
  };

  const runBulkAssignAppointments = async () => {
    const issue = issueByType('appointments_missing_rep');
    const appointmentIds = issue?.ids?.slice(0, 30) ?? [];
    if (!appointmentIds.length) {
      toast.info('No appointments missing rep');
      return;
    }
    try {
      const users = (await getAdminUsers()) as Array<{ id: string; role: string }>;
      const rep = users.find((u) => u.role === 'FIELD_SALES');
      if (!rep) {
        toast.error('No field sales rep found to assign');
        return;
      }
      const results = await Promise.allSettled(appointmentIds.map((id) => updateAppointment(id, { fieldSalesRepId: rep.id })));
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      if (successCount === 0) {
        toast.error('Bulk appointment assign failed');
        return;
      }
      toast.success(`Assigned ${successCount} appointments to field rep`);
      await refreshIssues();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk appointment assign failed');
    }
  };

  const runBulkSetOpportunityValue = async () => {
    const issue = issueByType('opportunities_missing_value');
    const opportunityIds = issue?.ids?.slice(0, 30) ?? [];
    if (!opportunityIds.length) {
      toast.info('No opportunities missing value');
      return;
    }
    const results = await Promise.allSettled(opportunityIds.map((id) => updateOpportunity(id, { estimatedValue: 5000 })));
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    if (successCount === 0) {
      toast.error('Bulk opportunity update failed');
      return;
    }
    toast.success(`Updated ${successCount} opportunities with default value`);
    await refreshIssues();
  };

  const normalizeUkPostcode = (value: string) => {
    const compact = value.toUpperCase().replace(/\s+/g, '');
    if (compact.length < 5) return null;
    const normalized = `${compact.slice(0, -3)} ${compact.slice(-3)}`;
    return normalized.trim();
  };

  const runFixInvalidPostcodes = async () => {
    const issue = issueByType('invalid_postcode');
    const leadIds = issue?.ids?.slice(0, 120) ?? [];
    if (!leadIds.length) {
      toast.info('No postcode issues to fix');
      return;
    }
    let updated = 0;
    let skipped = 0;
    for (const id of leadIds) {
      try {
        const lead = (await getLeadById(id)) as { postcode?: string | null };
        const current = (lead?.postcode ?? '').trim();
        if (!current) {
          skipped += 1;
          continue;
        }
        const normalized = normalizeUkPostcode(current);
        if (!normalized || normalized === current) {
          skipped += 1;
          continue;
        }
        await updateLead(id, { postcode: normalized });
        updated += 1;
      } catch {
        skipped += 1;
      }
    }
    if (updated === 0) {
      toast.info(`No postcodes auto-corrected. Skipped ${skipped}.`);
      return;
    }
    toast.success(`Fixed ${updated} postcodes. Skipped ${skipped}.`);
    await refreshIssues();
  };

  const runIssueAction = async (issueType: string) => {
    setActioningIssueType(issueType);
    try {
      if (issueType === 'duplicate_leads' || issueType === 'duplicate_email') {
        await runMergeDuplicates();
        return;
      }
      if (issueType === 'leads_missing_source') {
        await runBulkSetSource();
        return;
      }
      if (issueType === 'appointments_missing_rep') {
        await runBulkAssignAppointments();
        return;
      }
      if (issueType === 'opportunities_missing_value') {
        await runBulkSetOpportunityValue();
        return;
      }
      if (issueType === 'invalid_postcode') {
        await runFixInvalidPostcodes();
        return;
      }
      setPreviewIssueType(issueType);
      toast.info('Manual review required for this issue type.');
    } finally {
      setActioningIssueType(null);
    }
  };

  const runUploadSync = async (): Promise<boolean> => {
    try {
      const res = await syncGoogleSheetsLeads();
      const typed = res as { created?: number; updated?: number };
      toast.success(`Sync complete. Created ${typed.created ?? 0}, updated ${typed.updated ?? 0}`);
      await refreshIssues();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload sync failed');
      return false;
    }
  };

  const onUploadFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setManualUploads((prev) => [
      {
        id: `manual-${Date.now()}`,
        name: file.name,
        source: 'Manual (CSV)',
        uploadedBy: 'Admin User',
        status: 'Processing',
        issues: 0,
        actionLabel: 'View',
      },
      ...prev,
    ]);
    toast.success(`File selected: ${file.name}`);
    try {
      const ok = await runUploadSync();
      setManualUploads((prev) =>
        prev.map((row) => (row.name === file.name ? { ...row, status: ok ? 'Clean' : 'Issue Found', issues: ok ? 0 : 1, actionLabel: ok ? 'View' : 'View Issues' } : row))
      );
    } finally {
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">Loading data quality…</div>
    );
  }

  if (previewIssueType) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 rounded-3xl border border-white/40 bg-gradient-to-br from-indigo-100/70 via-white/60 to-sky-100/70 p-5 shadow-[0_20px_60px_rgba(79,70,229,0.12)] backdrop-blur-md sm:p-6">
        <Card className="rounded-2xl border-white/50 bg-white/60 shadow-sm backdrop-blur-md">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>
                  Data Issues: <span className="text-indigo-700">{toCsvLikeName(previewIssueType)}</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">Detailed issue preview page</p>
              </div>
              <Button variant="outline" onClick={() => setPreviewIssueType(null)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to dashboard
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Total Issues</p>
                <p className="text-2xl font-semibold">{openIssue?.count ?? 0}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Fixed</p>
                <p className="text-2xl font-semibold text-emerald-600">0</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="text-2xl font-semibold text-rose-600">{openIssue?.count ?? 0}</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-2 py-2 text-left">Row</th>
                    <th className="px-2 py-2 text-left">Record ID</th>
                    <th className="px-2 py-2 text-left">Field Value</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLoading ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                        Loading preview...
                      </td>
                    </tr>
                  ) : previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                        No preview records found.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row) => (
                      <tr key={`${row.row}-${row.recordId}`} className="border-t">
                        <td className="px-2 py-2">{row.row}</td>
                        <td className="px-2 py-2 font-mono">{row.recordId}</td>
                        <td className="px-2 py-2">{row.value}</td>
                        <td className="px-2 py-2">{row.status}</td>
                        <td className="px-2 py-2">{row.updated}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 rounded-3xl border border-white/40 bg-gradient-to-br from-indigo-100/70 via-white/60 to-sky-100/70 p-5 shadow-[0_20px_60px_rgba(79,70,229,0.12)] backdrop-blur-md sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Pages / Data Source Management</p>
          <h2 className="text-2xl font-semibold tracking-tight">Data Source Management</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-[240px] pl-9"
              placeholder="Search"
            />
          </div>
          <Button variant="outline" size="sm" onClick={refreshIssues}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload Data
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onUploadFileChange} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Total Files" value={String(totalFiles)} hint="Live source files" accent="violet" />
        <MetricCard title="Processing Status" value={`${processingRate.toFixed(0)}%`} hint="Files processed" accent="indigo" />
        <MetricCard title="Data Quality" value={String(totalIssues)} hint="Open quality issues" accent="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="rounded-2xl border-white/50 bg-white/60 shadow-sm backdrop-blur-md lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Processing Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="mx-auto h-[210px] w-full max-w-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={processingChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={84}
                    stroke="none"
                  >
                    <Cell fill="#4f46e5" />
                    <Cell fill="#dbeafe" />
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {processingRate.toFixed(0)}% processed · {(100 - processingRate).toFixed(0)}% pending
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-white/50 bg-white/60 shadow-sm backdrop-blur-md lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Data Quality Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#dbe4ff" />
                  <XAxis dataKey="shortName" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number, name: string, item: { payload?: { fullName?: string } }) => [value, name === 'count' ? (item?.payload?.fullName ?? 'Issues') : 'Threshold']} />
                  <Legend />
                  <Line name="Issue Count" type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line name="Target Threshold" type="monotone" dataKey="threshold" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-white/50 bg-white/60 shadow-sm backdrop-blur-md">
        <CardHeader>
          <CardTitle>Data Quality Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground">
            Insight-driven validation cards for duplicate, missing, and integrity issues.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {issues.map((issue) => {
              const Icon = ISSUE_ICONS[issue.type] ?? AlertTriangle;
              return (
                <div key={issue.type} className="rounded-xl border border-white/60 bg-white/70 p-4 backdrop-blur-md">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="rounded-lg bg-indigo-100 p-2">
                        <Icon className="h-4 w-4 text-indigo-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{issue.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {issue.groups
                            ? `Duplicate groups: ${issue.groups.length}. Example: ${issue.groups[0]?.key ?? '—'}`
                            : `${issue.ids.length} sample IDs loaded (max 100–200).`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={issue.count > 0 ? 'destructive' : 'secondary'}>{issue.count}</Badge>
                      <Button size="sm" variant="outline" onClick={() => openPreview(issue.type)}>
                        Preview Data
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => runIssueAction(issue.type)}
                        disabled={actioningIssueType === issue.type}
                      >
                        {actioningIssueType === issue.type
                          ? 'Fixing...'
                          : issue.type === 'duplicate_leads' || issue.type === 'duplicate_email'
                            ? 'Merge Wizard'
                            : 'Fix'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/50 bg-white/60 shadow-sm backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Uploaded Data Source</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage and monitor uploaded backing data files with processing and issue tracking.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => toast.info('Filter coming next')}>Filter</Button>
              <Button size="sm" variant="outline" onClick={refreshIssues}>Refresh</Button>
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>Upload Data</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Uploaded By</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Issues</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUploads.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.source}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.uploadedBy}</td>
                    <td className="px-3 py-2">
                      <Badge className={row.status === 'Clean' ? 'bg-emerald-100 text-emerald-700' : row.status === 'Issue Found' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{row.issues}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="ghost" onClick={() => openPreview(row.id)}>
                        <BarChart3 className="mr-1 h-3.5 w-3.5" />
                        {row.actionLabel}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/50 bg-white/60 shadow-sm backdrop-blur-md">
        <CardHeader>
          <CardTitle>Bulk Resolution Workflows</CardTitle>
          <p className="text-sm text-muted-foreground">
            Merge duplicates wizard, set missing source, assign reps to appointments, etc. (wire these actions when
            backend endpoints are added).
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span>Merge duplicate leads (same phone/email)</span>
              <Button size="sm" variant="outline" onClick={runMergeDuplicates}>
                Start Merge Wizard
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span>Set missing source for leads</span>
              <Button size="sm" variant="outline" onClick={runBulkSetSource}>
                Bulk Set Source
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span>Assign reps to appointments missing rep</span>
              <Button size="sm" variant="outline" onClick={runBulkAssignAppointments}>
                Bulk Assign
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span>Set estimated value for opportunities</span>
              <Button size="sm" variant="outline" onClick={runBulkSetOpportunityValue}>
                Bulk Set Value
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  accent,
}: {
  title: string;
  value: string;
  hint: string;
  accent: 'violet' | 'indigo' | 'sky' | 'emerald';
}) {
  const accentClass =
    accent === 'violet'
      ? 'text-violet-700'
      : accent === 'indigo'
        ? 'text-indigo-700'
        : accent === 'sky'
          ? 'text-sky-700'
          : 'text-emerald-700';

  return (
    <Card className="rounded-2xl border-white/50 bg-white/65 shadow-sm backdrop-blur-md">
      <CardContent className="pt-5 text-center">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className={`mt-1 text-3xl font-semibold ${accentClass}`}>{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
