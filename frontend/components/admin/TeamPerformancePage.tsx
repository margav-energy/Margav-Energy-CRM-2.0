import { useState, useEffect } from 'react';
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
import { Badge } from '../ui/badge';
import type { LucideIcon } from 'lucide-react';
import { Clock, Users, Target, Sun, TrendingUp } from 'lucide-react';
import { getRepPerformance } from '../../lib/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';

type RepPerf = {
  name: string;
  role?: string;
  calls: number;
  leads: number;
  appointments: number;
};

const ROLE_LABEL: Record<string, string> = {
  AGENT: 'Sales agent',
  QUALIFIER: 'Qualifier',
  FIELD_SALES: 'Field sales',
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function TeamPerformancePage() {
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'week' | 'month' | 'quarter'>('month');
  const [data, setData] = useState<RepPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const months = periodFilter === 'week' ? 1 : periodFilter === 'month' ? 1 : 3;
    setLoading(true);
    getRepPerformance(months)
      .then((raw) => setData(raw as unknown as RepPerf[]))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [periodFilter]);

  const spotlight = [...data]
    .sort((a, b) => b.calls - a.calls || b.leads - a.leads)
    .slice(0, 5);
  const filteredUsers = data.filter((u) => roleFilter === 'all' || u.role === roleFilter);
  const topPerformer = spotlight[0];
  const totals = filteredUsers.reduce(
    (acc, u) => {
      acc.calls += u.calls;
      acc.leads += u.leads;
      acc.appointments += u.appointments;
      return acc;
    },
    { calls: 0, leads: 0, appointments: 0 }
  );
  const employeeChartData = [...filteredUsers]
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 6)
    .map((u) => ({
      name: u.name.split(' ')[0],
      touchpoints: u.calls,
      leads: u.leads,
    }));

  const periodPhrase =
    periodFilter === 'week'
      ? 'Last 7 days'
      : periodFilter === 'month'
        ? 'Last ~30 days'
        : 'Last ~90 days';

  return (
    <div className="mx-auto max-w-7xl">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-white via-background to-emerald-50/30 p-5 sm:p-6 space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Team Performance
            </div>
            <p className="text-sm text-muted-foreground">
              Live team metrics across agents, qualifiers, and field sales.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:w-[420px]">
            <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as 'week' | 'month' | 'quarter')}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="quarter">This quarter</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-10 w-full bg-background">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="AGENT">Sales agent</SelectItem>
                <SelectItem value="QUALIFIER">Qualifier</SelectItem>
                <SelectItem value="FIELD_SALES">Field sales</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile icon={TrendingUp} label="Total activity" value={String(totals.calls)} hint={periodPhrase} accent="green" />
          <KpiTile icon={Users} label="Leads handled" value={String(totals.leads)} hint="Filtered scope" accent="blue" />
          <KpiTile icon={Target} label="Appointments" value={String(totals.appointments)} hint="Surveys / visits" accent="success" />
          <KpiTile
            icon={Clock}
            label="Top performer"
            value={topPerformer ? topPerformer.name : '—'}
            hint={topPerformer ? `${topPerformer.calls} total activity` : 'No data'}
            accent="neutral"
          />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm xl:col-span-1">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Recently Active</p>
              <Badge variant="secondary">{spotlight.length}</Badge>
            </div>
            <div className="space-y-2">
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-11 animate-pulse rounded-lg bg-muted/60" />
                ))}
              {!loading &&
                spotlight.map((entry) => (
                  <div
                    key={`${entry.name}-${entry.role ?? ''}`}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(entry.role && ROLE_LABEL[entry.role]) || entry.role?.replace('_', ' ') || '—'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{entry.calls}</span>
                  </div>
                ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm xl:col-span-2">
            <p className="text-sm font-medium mb-3">User Statistics</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={employeeChartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="touchpoints" stroke="#4f46e5" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Team Activity Statistics</p>
            <Badge variant="secondary">{periodPhrase}</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeChartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [v, 'Total activity']} />
                <Bar dataKey="touchpoints" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Full breakdown</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Filter by role to compare agents, qualifiers, and field sales for {periodPhrase.toLowerCase()}.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                  <TableHead className="pl-6 font-semibold">Team member</TableHead>
                  <TableHead className="font-semibold">Role</TableHead>
                  <TableHead className="text-right font-semibold">Leads</TableHead>
                  <TableHead className="text-right font-semibold">Total Activity</TableHead>
                  <TableHead className="text-right pr-6 font-semibold">Appointments</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="py-4">
                        <div className="h-4 animate-pulse rounded bg-muted/70" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading &&
                  filteredUsers.map((user) => (
                    <TableRow
                      key={`${user.name}-${user.role ?? ''}`}
                      className="border-border/50 transition-colors hover:bg-[var(--energy-green-1)]/[0.04]"
                    >
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--energy-green-1)]/20 to-[var(--energy-blue)]/15 text-xs font-semibold text-foreground">
                            {initials(user.name)}
                          </div>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {(user.role && ROLE_LABEL[user.role]) || user.role?.replace('_', ' ') || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{user.leads}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{user.calls}</TableCell>
                      <TableCell className="text-right tabular-nums pr-6">{user.appointments}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          {!loading && filteredUsers.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No one matches this role filter.</p>
          )}
          </div>
        </section>
      </div>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  accent: 'green' | 'blue' | 'success' | 'neutral';
}) {
  const ring =
    accent === 'green'
      ? 'from-[var(--energy-green-1)]/20 to-transparent'
      : accent === 'blue'
        ? 'from-[var(--energy-blue)]/15 to-transparent'
        : accent === 'success'
          ? 'from-emerald-200/50 to-transparent'
          : 'from-muted to-transparent';

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-white to-muted/20 p-5 shadow-sm">
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${ring} blur-2xl`} />
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--energy-green-1)]/15 to-[var(--energy-blue)]/10 text-[var(--energy-blue)]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground leading-snug">{hint}</p>
        </div>
      </div>
    </div>
  );
}
