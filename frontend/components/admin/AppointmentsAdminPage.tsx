import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { SummaryCard } from '../SummaryCard';
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
import { Calendar as CalendarIcon, List, MoreHorizontal, CalendarDays, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAdminAppointments } from '../../lib/api';
import type { AdminAppointment } from '../../lib/admin-types';

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
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

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

  const reps = [...new Set(appointments.map((a) => a.fieldSalesRepName).filter(Boolean))] as string[];
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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Scheduled Today"
          value={scheduledCount}
          icon={CalendarIcon}
          change="This week"
          changeType="neutral"
        />
        <SummaryCard
          title="Completed"
          value={completedCount}
          icon={CalendarDays}
          change="This period"
          changeType="positive"
        />
        <SummaryCard
          title="No-Show Rate"
          value={`${noShowRate.toFixed(1)}%`}
          icon={XCircle}
          change="Target: &lt;10%"
          changeType={noShowRate > 10 ? 'negative' : 'positive'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appointments Management</CardTitle>
          <p className="text-sm text-muted-foreground">
            Operational calendar and scheduling control. Reassign, reschedule, cancel.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
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
                {reps.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {view === 'list' && (
            <>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading...</div>
            ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-10"></TableHead>
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Reassign rep</DropdownMenuItem>
                            <DropdownMenuItem>Reschedule</DropdownMenuItem>
                            <DropdownMenuItem>Cancel (with reason)</DropdownMenuItem>
                            <DropdownMenuItem>Add note</DropdownMenuItem>
                            <DropdownMenuItem>View lead</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-b bg-muted/40">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
