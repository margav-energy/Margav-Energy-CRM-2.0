import { useEffect, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  PoundSterling,
  Target,
  MessageSquare,
  TrendingDown,
  ChartPie,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { getAdminOverview, getAdminOverviewCharts, type AdminChartPeriod } from '../../lib/api';
import type { AdminOverviewData } from '../../lib/admin-types';
import { formatGbpCompact } from '../../lib/formatCurrency';

const FUNNEL_COLORS = ['#3b82f6', '#60a5fa', '#38bdf8', '#22d3ee', '#34d399', '#10b981'];
const APPOINTMENT_OUTCOME_COLORS = ['#7c3aed', '#ef4444', '#0ea5e9', '#f59e0b', '#14b8a6', '#16a34a'];

const STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6',
  CONTACTED: '#60a5fa',
  INTERESTED: '#34d399',
  QUALIFYING: '#22c55e',
  QUALIFIED: '#10b981',
  SOLD: '#d97706',
  APPOINTMENT_SET: '#059669',
  NOT_INTERESTED: '#94a3b8',
  DEPOSITION: '#64748b',
  NOT_QUALIFIED: '#ef4444',
};

function chartPeriodLabel(period: AdminChartPeriod): string {
  switch (period) {
    case 'week':
      return 'This week';
    case 'quarter':
      return 'This quarter';
    default:
      return 'This month';
  }
}

function formatChartRangeHint(period: AdminChartPeriod, periodStartIso: string) {
  const d = new Date(periodStartIso);
  const opts: Intl.DateTimeFormatOptions =
    period === 'month'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : period === 'quarter'
        ? { day: 'numeric', month: 'long', year: 'numeric' }
        : { weekday: 'short', day: 'numeric', month: 'short' };
  return `Data from ${d.toLocaleDateString('en-GB', opts)}`;
}

export function AdminOverview() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<AdminChartPeriod>('month');
  const [chartData, setChartData] = useState<Awaited<ReturnType<typeof getAdminOverviewCharts>> | null>(null);
  const [chartsLoading, setChartsLoading] = useState(true);

  useEffect(() => {
    getAdminOverview()
      .then((res) => setData(res as unknown as AdminOverviewData))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setChartsLoading(true);
    getAdminOverviewCharts(chartPeriod)
      .then(setChartData)
      .catch(() => setChartData(null))
      .finally(() => setChartsLoading(false));
  }, [chartPeriod]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">{loading ? 'Loading...' : 'Failed to load'}</div>
      </div>
    );
  }

  const { metrics } = data;
  const m = metrics;
  const y = m.newLeadsYesterday ?? 0;
  const prior = m.wonRevenuePriorMonth ?? 0;
  const wonDeltaPct =
    prior > 0 && m.wonRevenueThisMonth !== undefined
      ? (((m.wonRevenueThisMonth - prior) / prior) * 100).toFixed(0)
      : null;

  const pieSource = chartData?.leadsByStatus ?? {};
  const totalLeadsFiltered = Object.values(pieSource).reduce((a, b) => a + b, 0);
  const funnelRows = chartData?.funnelSnapshot ?? [];
  const appointmentOutcomeRows = chartData?.appointmentOutcomeSnapshot ?? [];
  const stageTotal = funnelRows.reduce((sum, row) => sum + row.count, 0);
  const appointmentOutcomeTotal = appointmentOutcomeRows.reduce((sum, row) => sum + row.count, 0);
  const appointmentBooked =
    funnelRows.find((row) => row.stage === 'Appointment Booked')?.count ?? 0;
  const soldCount = appointmentOutcomeRows.find((row) => row.stage === 'Sold')?.count ?? 0;
  const soldRate = appointmentOutcomeTotal > 0 ? Math.round((soldCount / appointmentOutcomeTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl pb-8">
      <div className="rounded-3xl border border-white/70 bg-gradient-to-br from-white/55 via-indigo-50/45 to-violet-100/45 p-5 sm:p-6 space-y-6 backdrop-blur-xl shadow-[0_18px_45px_rgba(99,102,241,0.16)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin Overview</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live CRM operations metrics and pipeline movement. Operational alerts appear in the header bell.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm font-medium text-muted-foreground">Chart period</span>
            <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as AdminChartPeriod)}>
              <SelectTrigger className="w-[220px] bg-background">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="quarter">This quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MonthStat
            icon={PoundSterling}
            label="Won revenue"
            value={formatGbpCompact(m.wonRevenueThisMonth)}
            sub={
              wonDeltaPct != null
                ? `${Number(wonDeltaPct) >= 0 ? '+' : ''}${wonDeltaPct}% vs prior month`
                : prior <= 0
                  ? '—'
                  : undefined
            }
          />
          <MonthStat
            icon={Target}
            label="Pipeline value"
            value={formatGbpCompact(m.pipelineValue)}
            sub={`${m.pipelineOpportunityCount ?? 0} open`}
          />
          <MonthStat
            icon={TrendingDown}
            label="Lost"
            value={m.lostOpportunitiesThisMonth}
            sub="Opportunities lost"
          />
          <MonthStat
            icon={Calendar}
            label="No-show rate"
            value={`${(m.noShowRate * 100).toFixed(0)}%`}
            sub="Completed vs no-show"
          />
          <MonthStat
            icon={MessageSquare}
            label="Booked via SMS"
            value={m.bookedViaSms}
            sub="SMS bookings"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatBlock label="New leads today" value={m.newLeadsToday} footer={<span>Yesterday {y}</span>} />
          <StatBlock
            label="Appointments today"
            value={m.appointmentsToday}
            footer={<span>This week {m.appointmentsThisWeek}</span>}
          />
          <StatBlock label="NEW >= 5 min" value={m.leadsNotContacted5Min} footer={<span>Awaiting first action</span>} />
          <StatBlock label="NEW >= 15 min" value={m.leadsNotContacted15Min} footer={<span>Urgent SLA backlog</span>} />
        </div>

        {chartData && (
          <p className="text-xs text-muted-foreground">
            {formatChartRangeHint(chartPeriod, chartData.periodStart)}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-white/70 bg-white/45 px-3 py-3 text-center backdrop-blur-md">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Stage total</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{stageTotal}</p>
          </div>
          <div className="rounded-lg border border-white/70 bg-white/45 px-3 py-3 text-center backdrop-blur-md">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Appt booked</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{appointmentBooked}</p>
          </div>
          <div className="rounded-lg border border-white/70 bg-white/45 px-3 py-3 text-center backdrop-blur-md">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Outcome total</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{appointmentOutcomeTotal}</p>
          </div>
          <div className="rounded-lg border border-white/70 bg-white/45 px-3 py-3 text-center backdrop-blur-md">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Sold rate</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{soldRate}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="rounded-2xl border-white/70 bg-white/45 shadow-sm backdrop-blur-md text-center">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-base font-semibold text-center">Outcome Stages</CardTitle>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Stage totals for leads in the selected window.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {chartsLoading ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm rounded-xl bg-muted/30">
                Loading chart…
              </div>
            ) : !funnelRows.length || funnelRows.every((s) => s.count === 0) ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm rounded-xl bg-muted/30">
                No stage data for {chartPeriodLabel(chartPeriod).toLowerCase()}
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
                <div className="h-56 w-full max-w-[260px] mx-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={funnelRows} dataKey="count" nameKey="stage" innerRadius={56} outerRadius={84}>
                        {funnelRows.map((row, i) => (
                          <Cell key={row.stage} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 max-w-[220px] mx-auto space-y-2 text-xs text-left">
                  {funnelRows.map((row, i) => (
                    <li key={row.stage} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                        <span className="text-muted-foreground">{row.stage}</span>
                      </span>
                      <span className="font-medium tabular-nums">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/70 bg-white/45 shadow-sm backdrop-blur-md text-center overflow-hidden">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-base font-semibold text-center">Appointment Outcomes</CardTitle>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Outcomes for appointments in the selected window.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {chartsLoading ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm rounded-xl bg-muted/30">
                Loading chart…
              </div>
            ) : !appointmentOutcomeRows.length || appointmentOutcomeRows.every((s) => s.count === 0) ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm rounded-xl bg-muted/30">
                No appointment outcome data for {chartPeriodLabel(chartPeriod).toLowerCase()}
              </div>
            ) : (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
                <div className="h-56 w-full max-w-[220px] mx-auto shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={appointmentOutcomeRows} dataKey="count" nameKey="stage" innerRadius={56} outerRadius={84}>
                        {appointmentOutcomeRows.map((row, i) => (
                          <Cell key={row.stage} fill={APPOINTMENT_OUTCOME_COLORS[i % APPOINTMENT_OUTCOME_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, 'Count']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 max-w-[190px] mx-auto space-y-2 text-xs text-left break-words">
                  {appointmentOutcomeRows.map((row, i) => (
                    <li key={row.stage} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: APPOINTMENT_OUTCOME_COLORS[i % APPOINTMENT_OUTCOME_COLORS.length] }} />
                        <span className="text-muted-foreground">{row.stage}</span>
                      </span>
                      <span className="font-medium tabular-nums">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-white/70 bg-white/45 shadow-sm backdrop-blur-md text-center">
          <CardHeader className="px-6 pt-6">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <ChartPie className="h-4 w-4 text-muted-foreground shrink-0" />
              <CardTitle className="text-base font-semibold">Leads by status</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Leads <span className="font-medium">created</span> in the window, grouped by current status.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {chartsLoading ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm rounded-xl bg-muted/30">
                Loading chart…
              </div>
            ) : (() => {
                const statusData = Object.entries(pieSource)
                  .filter(([, count]) => count > 0)
                  .map(([status, count]) => ({
                    name: status.replace(/_/g, ' '),
                    value: count,
                    fill: STATUS_COLORS[status] || '#94a3b8',
                    key: status,
                  }));
                if (statusData.length === 0) {
                  return (
                    <div className="h-52 flex items-center justify-center text-muted-foreground text-sm rounded-xl bg-muted/30">
                      No leads for {chartPeriodLabel(chartPeriod).toLowerCase()}
                    </div>
                  );
                }
                return (
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8 md:justify-center">
                    <div className="mx-auto w-44 shrink-0 h-44 sm:w-52 sm:h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={76}
                            paddingAngle={2}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {statusData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [value, 'Leads']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="min-w-0 flex-1 max-w-sm mx-auto space-y-2.5 text-sm text-left">
                      {statusData.map((row) => {
                        const pct =
                          totalLeadsFiltered > 0 ? Math.round((row.value / totalLeadsFiltered) * 100) : 0;
                        return (
                          <li
                            key={row.key}
                            className="flex items-center justify-between gap-4 border-b border-border/50 pb-2.5 last:border-0 last:pb-0"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: row.fill }}
                              />
                              <span className="truncate capitalize text-foreground">{row.name}</span>
                            </span>
                            <span className="tabular-nums text-muted-foreground shrink-0">
                              <span className="font-medium text-foreground">{row.value}</span>
                              <span className="mx-1.5 text-border">·</span>
                              {pct}%
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  footer,
}: {
  label: string;
  value: number;
  footer: ReactNode;
}) {
  return (
    <div className="w-full max-w-xs rounded-xl border border-white/60 bg-white/65 p-5 shadow-sm mx-auto backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      <div className="mt-3 text-sm leading-relaxed">{footer}</div>
    </div>
  );
}

function MonthStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center rounded-xl border border-white/60 bg-white/65 p-4 shadow-sm text-center backdrop-blur-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/70 border border-white/40">
        <Icon className="h-4 w-4 text-[var(--energy-blue)]" />
      </div>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight px-0.5">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-foreground break-all">{value}</p>
      {sub != null && sub !== '' && (
        <p className="mt-2 text-[10px] text-muted-foreground leading-snug border-t border-border/40 pt-2 w-full">
          {sub}
        </p>
      )}
    </div>
  );
}
