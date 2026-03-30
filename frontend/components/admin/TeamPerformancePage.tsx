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
import { Clock, Users, Target, Sun, Sparkles, PhoneForwarded, Home } from 'lucide-react';
import { getRepPerformance, getTeamWorkload } from '../../lib/api';

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
  const [workload, setWorkload] = useState<{
    avgLeadsPerAgent: number;
    avgAppointmentsPerRep: number;
    avgFirstResponseMinutes: number | null;
  } | null>(null);

  useEffect(() => {
    const months = periodFilter === 'week' ? 1 : periodFilter === 'month' ? 1 : 3;
    setLoading(true);
    getRepPerformance(months)
      .then((raw) => setData(raw as unknown as RepPerf[]))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [periodFilter]);

  useEffect(() => {
    getTeamWorkload(periodFilter)
      .then(setWorkload)
      .catch(() => setWorkload(null));
  }, [periodFilter]);

  const spotlight = [...data]
    .sort((a, b) => b.calls - a.calls || b.leads - a.leads)
    .slice(0, 5);
  const filteredUsers = data.filter((u) => roleFilter === 'all' || u.role === roleFilter);

  const periodPhrase =
    periodFilter === 'week'
      ? 'Last 7 days'
      : periodFilter === 'month'
        ? 'Last ~30 days'
        : 'Last ~90 days';

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Hero — Margav Energy context (title lives in app header) */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--energy-green-1)]/20 bg-gradient-to-br from-white via-[var(--energy-green-1)]/[0.07] to-[var(--energy-blue)]/[0.06] shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--energy-green-2)]/15 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[var(--energy-blue)]/10 blur-3xl"
          aria-hidden
        />
        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--energy-green-1)]/25 bg-white/80 px-3 py-1 text-xs font-medium text-[var(--energy-green-2)] shadow-sm backdrop-blur-sm">
                <Sun className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Margav Energy · Home solar &amp; energy
              </div>
              <p className="text-base text-foreground/90 leading-relaxed">
                See how your team is supporting homeowners through the pipeline—leads coming in, qualifiers on
                callbacks, and field reps booking surveys. Numbers reflect CRM activity for the period you select.
              </p>
              <ul className="grid gap-2 sm:grid-cols-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2 border border-border/50">
                  <PhoneForwarded className="h-4 w-4 mt-0.5 shrink-0 text-[var(--energy-green-2)]" />
                  <span>
                    <span className="font-medium text-foreground/80">Agents</span> — new leads &amp; first contact
                  </span>
                </li>
                <li className="flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2 border border-border/50">
                  <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-[var(--energy-blue)]" />
                  <span>
                    <span className="font-medium text-foreground/80">Qualifiers</span> — qualification &amp; booking
                  </span>
                </li>
                <li className="flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2 border border-border/50">
                  <Home className="h-4 w-4 mt-0.5 shrink-0 text-[var(--energy-green-1)]" />
                  <span>
                    <span className="font-medium text-foreground/80">Field</span> — home visits &amp; appointments
                  </span>
                </li>
              </ul>
            </div>

            <div className="w-full shrink-0 space-y-3 rounded-xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md sm:w-[min(100%,20rem)]">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">View</p>
              <div className="flex flex-col gap-3">
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-11 w-full border-border/80 bg-white">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="AGENT">Sales agent</SelectItem>
                    <SelectItem value="QUALIFIER">Qualifier</SelectItem>
                    <SelectItem value="FIELD_SALES">Field sales</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as 'week' | 'month' | 'quarter')}>
                  <SelectTrigger className="h-11 w-full border-border/80 bg-white">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This week</SelectItem>
                    <SelectItem value="month">This month</SelectItem>
                    <SelectItem value="quarter">This quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{periodPhrase} · aligned with Reports.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team health KPIs */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Team workload &amp; speed</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Averages help balance inbound solar leads and survey capacity across agents and field reps.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiTile
            icon={Users}
            label="Leads per agent"
            value={workload ? String(workload.avgLeadsPerAgent) : '—'}
            hint="New leads with an agent ÷ agent headcount"
            accent="green"
          />
          <KpiTile
            icon={Target}
            label="Appointments per rep"
            value={workload ? String(workload.avgAppointmentsPerRep) : '—'}
            hint="Booked visits ÷ field sales headcount"
            accent="blue"
          />
          <KpiTile
            icon={Clock}
            label="First response"
            value={workload?.avgFirstResponseMinutes != null ? `${workload.avgFirstResponseMinutes} min` : '—'}
            hint="Time from lead created to first status move off NEW"
            accent={workload?.avgFirstResponseMinutes != null && workload.avgFirstResponseMinutes <= 5 ? 'success' : 'neutral'}
          />
        </div>
      </section>

      {/* Activity spotlight */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Momentum</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Highest activity by touchpoints (leads + appointments). Great for spotting who is carrying the pipeline
            this period.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-xl bg-muted/60 border border-border/50"
              />
            ))}
          {!loading &&
            spotlight.map((entry, i) => (
              <article
                key={`${entry.name}-${entry.role ?? ''}`}
                className="group relative flex flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-[var(--energy-green-1)] via-[var(--energy-green-2)] to-[var(--energy-blue)] opacity-90 ${
                    i === 0 ? '' : 'opacity-40 group-hover:opacity-70'
                  }`}
                />
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-inner"
                    style={{
                      background: `linear-gradient(135deg, var(--energy-green-1), var(--energy-blue))`,
                    }}
                  >
                    {initials(entry.name)}
                  </div>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      i === 0
                        ? 'bg-amber-100 text-amber-800'
                        : i === 1
                          ? 'bg-slate-200 text-slate-800'
                          : i === 2
                            ? 'bg-orange-100 text-orange-900'
                            : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                </div>
                <p className="mt-4 font-semibold leading-snug line-clamp-2">{entry.name}</p>
                <Badge variant="secondary" className="mt-1.5 w-fit font-normal">
                  {(entry.role && ROLE_LABEL[entry.role]) || entry.role?.replace('_', ' ') || '—'}
                </Badge>
                <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-[var(--energy-green-2)]">
                  {entry.calls}
                </p>
                <p className="text-xs font-medium text-muted-foreground">touchpoints</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {entry.leads} leads · {entry.appointments} surveys / visits
                </p>
              </article>
            ))}
        </div>
        {!loading && spotlight.length === 0 && (
          <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            No activity in this window yet—once leads and appointments flow, your team will show up here.
          </p>
        )}
      </section>

      {/* Detail table */}
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
                  <TableHead className="text-right font-semibold">Touchpoints</TableHead>
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
