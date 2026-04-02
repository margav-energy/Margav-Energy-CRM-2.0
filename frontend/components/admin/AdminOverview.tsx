import { useEffect, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { usePage } from '../../lib/page-context';
import { AlertCard } from './AlertCard';
import type { LucideIcon } from 'lucide-react';
import {
  Clock,
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
  const page = usePage();

  const handleAlertAction = (action: string) => {
    if (!page) return;
    const map: Record<string, string> = {
      view: 'admin-leads',
      assign: 'admin-leads',
      set_appt: 'admin-appointments',
      view_tasks: 'tasks',
      inspect: 'admin-sms',
    };
    const target = map[action] || 'admin-leads';
    page.setCurrentPage(target);
  };

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

  const { metrics, alerts } = data;
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

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-8 text-center">
      {/* Row 1: Today + backlog */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <CardHeader className="pb-0 pt-6 px-6 border-b border-border/40 bg-muted/20">
            <CardTitle className="text-base font-semibold text-foreground">Today</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">Leads created and visits scheduled for today</p>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:justify-items-center">
              <StatBlock
                label="New leads"
                value={m.newLeadsToday}
                footer={
                  <>
                    <span className="text-muted-foreground">Yesterday</span>{' '}
                    <span className="tabular-nums font-medium text-foreground">{y}</span>
                    {m.newLeadsToday !== y && (
                      <span
                        className={`ml-2 tabular-nums ${
                          m.newLeadsToday > y ? 'text-emerald-600' : m.newLeadsToday < y ? 'text-amber-700' : ''
                        }`}
                      >
                        ({m.newLeadsToday - y >= 0 ? '+' : ''}
                        {m.newLeadsToday - y})
                      </span>
                    )}
                  </>
                }
              />
              <StatBlock
                label="Appointments"
                value={m.appointmentsToday}
                footer={
                  <>
                    <span className="text-muted-foreground">This week</span>{' '}
                    <span className="tabular-nums font-medium text-foreground">{m.appointmentsThisWeek}</span>{' '}
                    <span className="text-muted-foreground">scheduled</span>
                  </>
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`shadow-sm overflow-hidden ${
            (m.leadsNotContacted5Min ?? 0) > 0
              ? 'border-amber-300/80 bg-gradient-to-br from-amber-50/90 to-background dark:from-amber-950/30 dark:to-background'
              : 'border-border/80'
          }`}
        >
          <CardHeader className="pb-0 pt-6 px-6 border-b border-amber-200/50 dark:border-amber-900/40 bg-amber-100/30 dark:bg-amber-950/20">
            <CardTitle className="text-base font-semibold text-foreground flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
              Leads still &ldquo;NEW&rdquo;
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal leading-relaxed">
              Haven&apos;t been moved off NEW yet (timer from when the lead was created).
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-6">
            <div className="mx-auto grid max-w-md grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/60 bg-background/90 px-4 py-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">≥ 5 minutes</p>
                <p
                  className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${
                    m.leadsNotContacted5Min > 0 ? 'text-amber-800 dark:text-amber-200' : 'text-foreground'
                  }`}
                >
                  {m.leadsNotContacted5Min}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/90 px-4 py-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">≥ 15 minutes</p>
                <p
                  className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${
                    m.leadsNotContacted15Min > 0 ? 'text-red-700 dark:text-red-300' : 'text-foreground'
                  }`}
                >
                  {m.leadsNotContacted15Min}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* This month — single row */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardHeader className="px-6 pt-6 pb-4 border-b border-border/40 bg-muted/20">
          <CardTitle className="text-base font-semibold text-foreground">This month</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">Pipeline and outcomes (calendar month)</p>
        </CardHeader>
        <CardContent className="px-4 pb-6 pt-6 sm:px-6">
          <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1 snap-x snap-mandatory lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible lg:pb-0 lg:snap-none">
            <div className="min-w-[148px] shrink-0 snap-center lg:min-w-0">
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
            </div>
            <div className="min-w-[148px] shrink-0 snap-center lg:min-w-0">
              <MonthStat
                icon={Target}
                label="Pipeline value"
                value={formatGbpCompact(m.pipelineValue)}
                sub={`${m.pipelineOpportunityCount ?? 0} open`}
              />
            </div>
            <div className="min-w-[148px] shrink-0 snap-center lg:min-w-0">
              <MonthStat
                icon={TrendingDown}
                label="Lost"
                value={m.lostOpportunitiesThisMonth}
                sub="Opportunities lost"
              />
            </div>
            <div className="min-w-[148px] shrink-0 snap-center lg:min-w-0">
              <MonthStat
                icon={Calendar}
                label="No-show rate"
                value={`${(m.noShowRate * 100).toFixed(0)}%`}
                sub="Completed vs no-show"
              />
            </div>
            <div className="min-w-[148px] shrink-0 snap-center lg:min-w-0">
              <MonthStat
                icon={MessageSquare}
                label="Booked via SMS"
                value={m.bookedViaSms}
                sub="SMS bookings"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {alerts.length > 0 && (
        <section className="space-y-4">
          <div className="text-center">
            <h2 className="text-base font-semibold text-foreground">Alerts</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Items that may need action</p>
          </div>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.type}
                title={alert.title}
                count={alert.count}
                severity={alert.severity}
                entityIds={alert.entityIds}
                actions={alert.actions}
                onAction={handleAlertAction}
              />
            ))}
          </div>
        </section>
      )}

      {/* Charts — shared period */}
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-4">
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
          {chartData && (
            <span className="text-xs text-muted-foreground text-center sm:text-left max-w-md">
              {formatChartRangeHint(chartPeriod, chartData.periodStart)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Card className="border-border/80 shadow-sm text-left">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-base font-semibold text-center sm:text-left">Funnel</CardTitle>
            <p className="text-xs text-muted-foreground text-center sm:text-left mt-2">
              Stage volumes for leads and activity in the selected window.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {chartsLoading ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm rounded-xl bg-muted/30">
                Loading chart…
              </div>
            ) : !funnelRows.length || funnelRows.every((s) => s.count === 0) ? (
              <div className="h-52 flex items-center justify-center text-muted-foreground text-sm rounded-xl bg-muted/30">
                No funnel data for {chartPeriodLabel(chartPeriod).toLowerCase()}
              </div>
            ) : (
              <div className="space-y-2 max-w-xl mx-auto">
                {funnelRows.map((stage, i) => {
                  const n = funnelRows.length;
                  const widthPct = 100 - (i / (n - 1 || 1)) * 60;
                  return (
                    <div
                      key={stage.stage}
                      className="flex items-center gap-3 min-h-[2.25rem]"
                      title={`${stage.stage}: ${stage.count}`}
                    >
                      <div
                        className="h-9 rounded-lg flex items-center justify-center text-white text-xs font-medium px-3 min-w-0 shadow-sm"
                        style={{
                          width: `${Math.max(widthPct, 28)}%`,
                          backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                        }}
                      >
                        <span className="truncate">{stage.stage}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-muted-foreground shrink-0 w-10 text-right">
                        {stage.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm text-left">
          <CardHeader className="px-6 pt-6">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <ChartPie className="h-4 w-4 text-muted-foreground shrink-0" />
              <CardTitle className="text-base font-semibold">Leads by status</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground text-center sm:text-left mt-2">
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
                    <ul className="min-w-0 flex-1 max-w-sm mx-auto md:mx-0 space-y-2.5 text-sm">
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
    <div className="w-full max-w-xs rounded-xl border border-border/50 bg-background p-5 shadow-sm mx-auto">
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
    <div className="flex h-full flex-col items-center rounded-xl border border-border/50 bg-background p-4 shadow-sm text-center">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/80 border border-border/30">
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
