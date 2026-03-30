import React, { useState, useEffect, useCallback } from 'react';
import { QualifierKanban } from './QualifierKanban';
import type { QualifierLead } from './QualifierKanban';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { QualifierSummaryCard } from './QualifierSummaryCard';
import { Users, Target, Calendar, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { getLeads } from '../lib/api';

function getWeekBounds(): { thisWeekStart: Date; thisWeekEnd: Date; lastWeekStart: Date; lastWeekEnd: Date } {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + mondayOffset);
  thisMonday.setHours(0, 0, 0, 0);
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisMonday.getDate() + 6);
  thisSunday.setHours(23, 59, 59, 999);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setDate(thisMonday.getDate() - 1);
  lastSunday.setHours(23, 59, 59, 999);
  return {
    thisWeekStart: thisMonday,
    thisWeekEnd: thisSunday,
    lastWeekStart: lastMonday,
    lastWeekEnd: lastSunday,
  };
}

function isInRange(dateStr: string | undefined, start: Date, end: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

interface QualifierStats {
  leadsToQualify: number;
  leadsToQualifyThisWeek: number;
  leadsToQualifyLastWeek: number;
  qualifiedLeads: number;
  qualifiedThisWeek: number;
  qualifiedLastWeek: number;
  appointmentsScheduled: number;
  appointmentsThisWeek: number;
  appointmentsLastWeek: number;
  pendingFollowUp: number;
  pendingThisWeek: number;
  pendingLastWeek: number;
}

export function QualifierDashboard() {
  const [leads, setLeads] = useState<QualifierLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QualifierStats>({
    leadsToQualify: 0,
    leadsToQualifyThisWeek: 0,
    leadsToQualifyLastWeek: 0,
    qualifiedLeads: 0,
    qualifiedThisWeek: 0,
    qualifiedLastWeek: 0,
    appointmentsScheduled: 0,
    appointmentsThisWeek: 0,
    appointmentsLastWeek: 0,
    pendingFollowUp: 0,
    pendingThisWeek: 0,
    pendingLastWeek: 0,
  });

  const loadLeads = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLeads({ pageSize: 500 });
      const items = (res.items as QualifierLead[]) ?? [];
      setLeads(items);

      const { thisWeekStart, thisWeekEnd, lastWeekStart, lastWeekEnd } = getWeekBounds();
      const byStatus = (s: string) => (l: QualifierLead) => l.status === s;
      const byStatusIn = (...statuses: string[]) => (l: QualifierLead) => statuses.includes(l.status ?? '');
      const inThisWeek = (l: QualifierLead) => isInRange(l.createdAt, thisWeekStart, thisWeekEnd);
      const inLastWeek = (l: QualifierLead) => isInRange(l.createdAt, lastWeekStart, lastWeekEnd);

      const qualifying = items.filter(byStatus('QUALIFYING'));
      const qualified = items.filter(byStatus('QUALIFIED'));
      const appointmentSet = items.filter(byStatus('APPOINTMENT_SET'));
      const pending = items.filter(byStatusIn('QUALIFIER_CALLBACK', 'NO_CONTACT'));

      setStats({
        leadsToQualify: qualifying.length,
        leadsToQualifyThisWeek: qualifying.filter(inThisWeek).length,
        leadsToQualifyLastWeek: qualifying.filter(inLastWeek).length,
        qualifiedLeads: qualified.length,
        qualifiedThisWeek: qualified.filter(inThisWeek).length,
        qualifiedLastWeek: qualified.filter(inLastWeek).length,
        appointmentsScheduled: appointmentSet.length,
        appointmentsThisWeek: appointmentSet.filter(inThisWeek).length,
        appointmentsLastWeek: appointmentSet.filter(inLastWeek).length,
        pendingFollowUp: pending.length,
        pendingThisWeek: pending.filter(inThisWeek).length,
        pendingLastWeek: pending.filter(inLastWeek).length,
      });
    } catch {
      setLeads([]);
      setStats({
        leadsToQualify: 0,
        leadsToQualifyThisWeek: 0,
        leadsToQualifyLastWeek: 0,
        qualifiedLeads: 0,
        qualifiedThisWeek: 0,
        qualifiedLastWeek: 0,
        appointmentsScheduled: 0,
        appointmentsThisWeek: 0,
        appointmentsLastWeek: 0,
        pendingFollowUp: 0,
        pendingThisWeek: 0,
        pendingLastWeek: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const formatWeekChange = (thisWeek: number, lastWeek: number) => {
    if (lastWeek === 0) return thisWeek > 0 ? `${thisWeek} new this week` : 'No change';
    const diff = thisWeek - lastWeek;
    const pct = Math.round((diff / lastWeek) * 100);
    if (diff > 0) return `${thisWeek} this week vs ${lastWeek} last week (+${pct}%)`;
    if (diff < 0) return `${thisWeek} this week vs ${lastWeek} last week (${pct}%)`;
    return `${thisWeek} this week (same as last week)`;
  };

  const getChangeType = (thisWeek: number, lastWeek: number): 'positive' | 'negative' | 'neutral' =>
    thisWeek > lastWeek ? 'positive' : thisWeek < lastWeek ? 'negative' : 'neutral';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QualifierSummaryCard
          title="Leads to Qualify"
          value={stats.leadsToQualify}
          icon={Users}
          change={formatWeekChange(stats.leadsToQualifyThisWeek, stats.leadsToQualifyLastWeek)}
          changeType={getChangeType(stats.leadsToQualifyThisWeek, stats.leadsToQualifyLastWeek)}
          variant="amber"
        />
        <QualifierSummaryCard
          title="Qualified Leads"
          value={stats.qualifiedLeads}
          icon={Target}
          change={formatWeekChange(stats.qualifiedThisWeek, stats.qualifiedLastWeek)}
          changeType={getChangeType(stats.qualifiedThisWeek, stats.qualifiedLastWeek)}
          variant="emerald"
        />
        <QualifierSummaryCard
          title="Appointments Scheduled"
          value={stats.appointmentsScheduled}
          icon={Calendar}
          change={formatWeekChange(stats.appointmentsThisWeek, stats.appointmentsLastWeek)}
          changeType={getChangeType(stats.appointmentsThisWeek, stats.appointmentsLastWeek)}
          variant="blue"
        />
        <QualifierSummaryCard
          title="Pending Follow-up"
          value={stats.pendingFollowUp}
          icon={Clock}
          change={formatWeekChange(stats.pendingThisWeek, stats.pendingLastWeek)}
          changeType={getChangeType(stats.pendingThisWeek, stats.pendingLastWeek)}
          variant="violet"
        />
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="calendar">Appointment Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <QualifierKanban leads={leads} loading={loading} onUpdated={loadLeads} />
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Appointments</CardTitle>
              <p className="text-sm text-muted-foreground">
                View appointments via the Calendar page. Click leads in the pipeline to qualify and set appointments.
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Appointments scheduled for {stats.appointmentsScheduled} lead{stats.appointmentsScheduled !== 1 ? 's' : ''}.</p>
                <p className="text-sm mt-2">Use the Pipeline to qualify leads and set appointments.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
