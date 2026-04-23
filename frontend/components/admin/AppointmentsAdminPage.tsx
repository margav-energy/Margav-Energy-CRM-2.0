import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Calendar as CalendarIcon,
  List,
  MoreHorizontal,
  CalendarDays,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Activity,
  UserRound,
  Clock3,
  CheckCircle2,
  CircleDollarSign,
} from 'lucide-react';
import { getAdminAppointments, getFieldSalesReps, updateAppointment, updateAppointmentStatus } from '../../lib/api';
import type { AdminAppointment } from '../../lib/admin-types';
import { toast } from 'react-toastify';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildMonthCells(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7;
  const prevLast = new Date(year, month, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) {
    const day = prevLast - startPad + 1 + i;
    cells.push({ date: new Date(year, month - 1, day, 12, 0, 0, 0), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d, 12, 0, 0, 0), inMonth: true });
  }
  let nextD = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, nextD++, 12, 0, 0, 0), inMonth: false });
  }
  return cells;
}

export function AppointmentsAdminPage() {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [summaryAppointments, setSummaryAppointments] = useState<AdminAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [reps, setReps] = useState<Array<{ id: string; fullName: string }>>([]);
  const [reassignApt, setReassignApt] = useState<AdminAppointment | null>(null);
  const [rescheduleApt, setRescheduleApt] = useState<AdminAppointment | null>(null);
  const [noteApt, setNoteApt] = useState<AdminAppointment | null>(null);
  const [nextRepId, setNextRepId] = useState<string>('');
  const [nextScheduledAt, setNextScheduledAt] = useState<string>('');
  const [nextNote, setNextNote] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  useEffect(() => {
    getFieldSalesReps()
      .then((rows) => setReps((rows ?? []).map((r) => ({ id: r.id, fullName: r.fullName }))))
      .catch(() => setReps([]));
  }, []);

  useEffect(() => {
    const status = statusFilter !== 'all' ? statusFilter : undefined;
    getAdminAppointments({ status, pageSize: 500 })
      .then((r) => setSummaryAppointments(r.items as AdminAppointment[]))
      .catch(() => setSummaryAppointments([]));
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    const status = statusFilter !== 'all' ? statusFilter : undefined;
    if (view === 'calendar') {
      const y = calendarMonth.getFullYear();
      const m = calendarMonth.getMonth();
      const from = new Date(y, m, 1);
      const to = new Date(y, m + 1, 0, 23, 59, 59, 999);
      getAdminAppointments({
        status,
        from: from.toISOString(),
        to: to.toISOString(),
        pageSize: 500,
      })
        .then((r) => setAppointments(r.items as AdminAppointment[]))
        .catch(() => setAppointments([]))
        .finally(() => setLoading(false));
    } else {
      getAdminAppointments({ status })
        .then((r) => setAppointments(r.items as AdminAppointment[]))
        .catch(() => setAppointments([]))
        .finally(() => setLoading(false));
    }
  }, [view, statusFilter, calendarMonth]);

  const repNames = [...new Set(appointments.map((a) => a.fieldSalesRepName).filter(Boolean))] as string[];
  const filteredAppointments = appointments.filter((apt) => {
    const matchesRep = repFilter === 'all' || apt.fieldSalesRepName === repFilter;
    return matchesRep;
  });

  const byDay = useMemo(() => {
    const m = new Map<string, AdminAppointment[]>();
    for (const apt of filteredAppointments) {
      const k = dayKeyLocal(new Date(apt.scheduledAt));
      const list = m.get(k) ?? [];
      list.push(apt);
      m.set(k, list);
    }
    for (const [, list] of m) {
      list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    }
    return m;
  }, [filteredAppointments]);

  const completedCount = summaryAppointments.filter((a) => a.status === 'COMPLETED').length;
  const noShowCount = summaryAppointments.filter((a) => a.status === 'NO_SHOW').length;
  const scheduledCount = summaryAppointments.filter((a) => a.status === 'SCHEDULED').length;
  const total =
    completedCount +
    noShowCount +
    scheduledCount +
    summaryAppointments.filter((a) => a.status === 'CANCELLED').length;
  const noShowRate = total > 0 ? (noShowCount / total) * 100 : 0;
  const cancelledCount = summaryAppointments.filter((a) => a.status === 'CANCELLED').length;
  const upcomingCount = summaryAppointments.filter((a) => {
    return a.status === 'SCHEDULED' && new Date(a.scheduledAt).getTime() >= Date.now();
  }).length;
  const todayKey = dayKeyLocal(new Date());
  const todayAppointments = filteredAppointments.filter((a) => dayKeyLocal(new Date(a.scheduledAt)) === todayKey);
  const conversionRate = total > 0 ? (completedCount / total) * 100 : 0;

  const weekdayStats = useMemo(() => {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = Array.from({ length: 7 }, (_, i) => ({ label: labels[i], count: 0 }));
    for (const apt of filteredAppointments) {
      counts[new Date(apt.scheduledAt).getDay()].count += 1;
    }
    const max = Math.max(1, ...counts.map((c) => c.count));
    return counts.map((c) => ({ ...c, pct: Math.max(6, Math.round((c.count / max) * 100)) }));
  }, [filteredAppointments]);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const runStatusAction = async (appointmentId: string, status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW') => {
    setActioningId(appointmentId);
    try {
      await updateAppointmentStatus(appointmentId, status);
      toast.success('Appointment updated');
      const apiStatus = statusFilter !== 'all' ? statusFilter : undefined;
      const [summaryRes, listRes] = await Promise.all([
        getAdminAppointments({ status: apiStatus, pageSize: 500 }),
        view === 'calendar'
          ? (() => {
              const y = calendarMonth.getFullYear();
              const m = calendarMonth.getMonth();
              const from = new Date(y, m, 1);
              const to = new Date(y, m + 1, 0, 23, 59, 59, 999);
              return getAdminAppointments({
                status: apiStatus,
                from: from.toISOString(),
                to: to.toISOString(),
                pageSize: 500,
              });
            })()
          : getAdminAppointments({ status: apiStatus }),
      ]);
      setSummaryAppointments(summaryRes.items as AdminAppointment[]);
      setAppointments(listRes.items as AdminAppointment[]);
    } catch {
      toast.error('Could not update appointment');
    } finally {
      setActioningId(null);
    }
  };

  const runUpdateAction = async (appointmentId: string, payload: { fieldSalesRepId?: string; scheduledAt?: string; notes?: string }) => {
    setActioningId(appointmentId);
    try {
      await updateAppointment(appointmentId, payload);
      toast.success('Appointment updated');
      const apiStatus = statusFilter !== 'all' ? statusFilter : undefined;
      const [summaryRes, listRes] = await Promise.all([
        getAdminAppointments({ status: apiStatus, pageSize: 500 }),
        view === 'calendar'
          ? (() => {
              const y = calendarMonth.getFullYear();
              const m = calendarMonth.getMonth();
              const from = new Date(y, m, 1);
              const to = new Date(y, m + 1, 0, 23, 59, 59, 999);
              return getAdminAppointments({
                status: apiStatus,
                from: from.toISOString(),
                to: to.toISOString(),
                pageSize: 500,
              });
            })()
          : getAdminAppointments({ status: apiStatus }),
      ]);
      setSummaryAppointments(summaryRes.items as AdminAppointment[]);
      setAppointments(listRes.items as AdminAppointment[]);
    } catch {
      toast.error('Could not update appointment');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="rounded-3xl border border-blue-200/60 bg-gradient-to-br from-white via-blue-50/25 to-emerald-50/20 p-5 sm:p-6 space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              A smarter operational dashboard for qualifiers and field reps. Track daily schedule, reminders, and outcomes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'calendar')}>
              <TabsList>
                <TabsTrigger value="list">
                  <List className="h-4 w-4 mr-2" />
                  List
                </TabsTrigger>
                <TabsTrigger value="calendar">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Calendar
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <TopMetric title="Today" value={String(todayAppointments.length)} icon={Clock3} />
          <TopMetric title="Upcoming" value={String(upcomingCount)} icon={CalendarDays} />
          <TopMetric title="Completed" value={String(completedCount)} icon={CheckCircle2} />
          <TopMetric title="Conversion" value={`${conversionRate.toFixed(1)}%`} icon={Activity} />
          <TopMetric title="No-show rate" value={`${noShowRate.toFixed(1)}%`} icon={XCircle} />
        </section>

        <Card className="rounded-2xl border-blue-200/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-blue-900">Appointments Management</CardTitle>
            <p className="text-sm text-muted-foreground">
              Operational calendar and scheduling control. Reassign, reschedule, cancel.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="NO_SHOW">No Show</SelectItem>
              </SelectContent>
            </Select>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Field Rep" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reps</SelectItem>
                {repNames.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setStatusFilter('SCHEDULED')}>
              Focus Scheduled
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatusFilter('COMPLETED')}>
              View Completed
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatusFilter('NO_SHOW')}>
              Review No-shows
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStatusFilter('all')}>
              Reset
            </Button>
          </div>

          {view === 'list' && (
            <>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading...</div>
            ) : (
            <div className="border border-blue-100 rounded-lg overflow-hidden bg-background">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50/70">
                    <TableHead>Lead</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[220px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.map((apt) => (
                    <TableRow key={apt.id}>
                      <TableCell className="font-medium">{apt.leadName}</TableCell>
                      <TableCell>{formatDate(apt.scheduledAt)}</TableCell>
                      <TableCell>{apt.fieldSalesRepName || <span className="text-amber-600">— Unassigned</span>}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            apt.status === 'COMPLETED'
                              ? 'default'
                              : apt.status === 'NO_SHOW'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {apt.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{apt.address || '—'}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">{apt.notes || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          {apt.status === 'SCHEDULED' ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                onClick={() => void runStatusAction(apt.id, 'COMPLETED')}
                                disabled={actioningId === apt.id}
                              >
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-amber-200 text-amber-700 hover:bg-amber-50"
                                onClick={() => void runStatusAction(apt.id, 'NO_SHOW')}
                                disabled={actioningId === apt.id}
                              >
                                No-show
                              </Button>
                            </>
                          ) : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setReassignApt(apt);
                                  const rep = reps.find((r) => r.fullName === apt.fieldSalesRepName);
                                  setNextRepId(rep?.id ?? '');
                                }}
                              >
                                Reassign rep
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setRescheduleApt(apt);
                                  const d = new Date(apt.scheduledAt);
                                  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                                    .toISOString()
                                    .slice(0, 16);
                                  setNextScheduledAt(local);
                                }}
                              >
                                Reschedule
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => void runStatusAction(apt.id, 'CANCELLED')}
                                disabled={apt.status === 'CANCELLED'}
                              >
                                Cancel (with reason)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  setNoteApt(apt);
                                  setNextNote(apt.notes ?? '');
                                }}
                              >
                                Add note
                              </DropdownMenuItem>
                              <DropdownMenuItem>View lead</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}
            </>
          )}

          {view === 'calendar' && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
            <div className="rounded-lg border border-blue-100 bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-blue-50/70">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setCalendarMonth((d) => {
                        const n = new Date(d);
                        n.setMonth(n.getMonth() - 1);
                        return n;
                      })
                    }
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setCalendarMonth((d) => {
                        const n = new Date(d);
                        n.setMonth(n.getMonth() + 1);
                        return n;
                      })
                    }
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <h3 className="text-lg font-semibold tabular-nums">
                  {calendarMonth.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
                </h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const n = new Date();
                    n.setDate(1);
                    n.setHours(0, 0, 0, 0);
                    setCalendarMonth(n);
                  }}
                >
                  Today
                </Button>
              </div>
              {loading ? (
                <div className="py-16 text-center text-muted-foreground">Loading calendar…</div>
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-px bg-border text-center text-xs font-medium text-muted-foreground">
                    {WEEKDAYS.map((w) => (
                      <div key={w} className="bg-muted/30 py-2">
                        {w}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-px bg-border">
                    {buildMonthCells(calendarMonth.getFullYear(), calendarMonth.getMonth()).map((cell, idx) => {
                      const key = dayKeyLocal(cell.date);
                      const dayApts = byDay.get(key) ?? [];
                      const isToday =
                        dayKeyLocal(new Date()) === key && cell.inMonth;
                      return (
                        <div
                          key={`${key}-${idx}`}
                          className={`min-h-[100px] sm:min-h-[112px] bg-background p-1.5 flex flex-col gap-1 ${
                            cell.inMonth ? '' : 'bg-muted/20 text-muted-foreground'
                          }`}
                        >
                          <div className="flex justify-end">
                            <span
                              className={`text-xs tabular-nums rounded px-1.5 py-0.5 ${
                                isToday ? 'bg-primary text-primary-foreground font-semibold' : ''
                              }`}
                            >
                              {cell.date.getDate()}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 min-h-0 flex-1 overflow-y-auto max-h-[88px] sm:max-h-[92px]">
                            {dayApts.slice(0, 4).map((apt) => (
                              <div
                                key={apt.id}
                                title={`${apt.leadName} · ${formatDate(apt.scheduledAt)}${apt.fieldSalesRepName ? ` · ${apt.fieldSalesRepName}` : ''}`}
                                className="text-[10px] sm:text-xs leading-tight rounded px-1 py-0.5 truncate border bg-muted/60 hover:bg-muted"
                              >
                                <span className="font-medium text-foreground/90">
                                  {new Date(apt.scheduledAt).toLocaleTimeString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>{' '}
                                <span className="text-muted-foreground">{apt.leadName}</span>
                              </div>
                            ))}
                            {dayApts.length > 4 && (
                              <div className="text-[10px] text-muted-foreground px-1">+{dayApts.length - 4} more</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="rounded-lg border border-violet-100 bg-gradient-to-br from-white to-violet-50/40 p-4 shadow-sm">
              <p className="text-sm font-medium mb-3 text-violet-900">Today&apos;s Schedule</p>
              <div className="space-y-2">
                {(byDay.get(dayKeyLocal(new Date())) ?? []).slice(0, 8).map((apt) => (
                  <div key={apt.id} className="rounded-md border border-border/60 bg-background px-3 py-2">
                    <p className="text-sm font-medium truncate">{apt.leadName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(apt.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      {apt.fieldSalesRepName || 'Unassigned'}
                    </p>
                  </div>
                ))}
                {(byDay.get(dayKeyLocal(new Date())) ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">No appointments today</p>
                )}
              </div>
              <div className="mt-4 rounded-md bg-violet-100/60 px-3 py-2 text-xs text-violet-800">
                Reminder: confirm rep assignment and lead availability before scheduled time.
              </div>
            </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-emerald-200/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Weekly Appointment Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2">
              {weekdayStats.map((d) => (
                <div key={d.label} className="flex flex-col items-center gap-1">
                  <div className="h-24 w-full rounded-md bg-muted/50 relative overflow-hidden">
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-md bg-gradient-to-t from-emerald-500 to-teal-400"
                      style={{ height: `${d.pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">{d.label}</span>
                  <span className="text-xs font-medium tabular-nums">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-violet-200/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">CRM Appointment Ops</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="flex items-center gap-2"><UserRound className="h-4 w-4" /> Assigned reps</span>
              <span className="font-semibold tabular-nums">{repNames.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Scheduled queue</span>
              <span className="font-semibold tabular-nums">{scheduledCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="flex items-center gap-2"><XCircle className="h-4 w-4" /> Exceptions (cancelled + no-show)</span>
              <span className="font-semibold tabular-nums">{cancelledCount + noShowCount}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={!!reassignApt} onOpenChange={(o) => !o && setReassignApt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign field rep</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Field rep</Label>
            <Select value={nextRepId} onValueChange={setNextRepId}>
              <SelectTrigger>
                <SelectValue placeholder="Select field rep" />
              </SelectTrigger>
              <SelectContent>
                {reps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignApt(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!reassignApt || !nextRepId) return;
                void runUpdateAction(reassignApt.id, { fieldSalesRepId: nextRepId });
                setReassignApt(null);
              }}
              disabled={!nextRepId || actioningId === reassignApt?.id}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rescheduleApt} onOpenChange={(o) => !o && setRescheduleApt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>New date and time</Label>
            <Input type="datetime-local" value={nextScheduledAt} onChange={(e) => setNextScheduledAt(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleApt(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!rescheduleApt || !nextScheduledAt) return;
                void runUpdateAction(rescheduleApt.id, { scheduledAt: new Date(nextScheduledAt).toISOString() });
                setRescheduleApt(null);
              }}
              disabled={!nextScheduledAt || actioningId === rescheduleApt?.id}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!noteApt} onOpenChange={(o) => !o && setNoteApt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add note</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea value={nextNote} onChange={(e) => setNextNote(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteApt(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!noteApt) return;
                void runUpdateAction(noteApt.id, { notes: nextNote });
                setNoteApt(null);
              }}
              disabled={actioningId === noteApt?.id}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

function TopMetric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: typeof CalendarIcon;
}) {
  const accentClass =
    title === 'Completed'
      ? 'from-emerald-50 to-emerald-100/40 border-emerald-200/70'
      : title === 'No-show rate'
      ? 'from-rose-50 to-rose-100/40 border-rose-200/70'
      : title === 'Cancelled'
      ? 'from-amber-50 to-amber-100/40 border-amber-200/70'
      : 'from-blue-50 to-indigo-100/40 border-blue-200/70';

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 shadow-sm ${accentClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        </div>
        <div className="rounded-lg border border-white/70 bg-white/70 p-2">
          <Icon className="h-4 w-4 text-blue-700" />
        </div>
      </div>
    </div>
  );
}
