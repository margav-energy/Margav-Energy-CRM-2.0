import React, { useState, useEffect, useCallback } from 'react';
import { QUALIFIER_JOURNEY_STAGES } from './QualifierKanban';
import type { QualifierLead } from './QualifierKanban';
import { QualifierSummaryCard } from './QualifierSummaryCard';
import { QualifierDashboardQueueView, queueKindForJourneyStage, type QualifierQueueKind } from './QualifierDashboardQueueView';
import { GoogleCalendarEmbed } from './GoogleCalendarEmbed';
import { Users, Calendar, PhoneCall, Wind } from 'lucide-react';
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
  callback: number;
  callbackThisWeek: number;
  callbackLastWeek: number;
  appointmentSet: number;
  appointmentThisWeek: number;
  appointmentLastWeek: number;
  sweep: number;
  sweepThisWeek: number;
  sweepLastWeek: number;
}

export function QualifierDashboard() {
  const [leads, setLeads] = useState<QualifierLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueView, setQueueView] = useState<QualifierQueueKind | null>(null);
  const [stats, setStats] = useState<QualifierStats>({
    leadsToQualify: 0,
    leadsToQualifyThisWeek: 0,
    leadsToQualifyLastWeek: 0,
    callback: 0,
    callbackThisWeek: 0,
    callbackLastWeek: 0,
    appointmentSet: 0,
    appointmentThisWeek: 0,
    appointmentLastWeek: 0,
    sweep: 0,
    sweepThisWeek: 0,
    sweepLastWeek: 0,
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
      const callback = items.filter(byStatus('QUALIFIER_CALLBACK'));
      const appointmentSet = items.filter(byStatus('APPOINTMENT_SET'));
      const sweep = items.filter(byStatusIn('NOT_INTERESTED', 'DEPOSITION'));

      setStats({
        leadsToQualify: qualifying.length,
        leadsToQualifyThisWeek: qualifying.filter(inThisWeek).length,
        leadsToQualifyLastWeek: qualifying.filter(inLastWeek).length,
        callback: callback.length,
        callbackThisWeek: callback.filter(inThisWeek).length,
        callbackLastWeek: callback.filter(inLastWeek).length,
        appointmentSet: appointmentSet.length,
        appointmentThisWeek: appointmentSet.filter(inThisWeek).length,
        appointmentLastWeek: appointmentSet.filter(inLastWeek).length,
        sweep: sweep.length,
        sweepThisWeek: sweep.filter(inThisWeek).length,
        sweepLastWeek: sweep.filter(inLastWeek).length,
      });
    } catch {
      setLeads([]);
      setStats({
        leadsToQualify: 0,
        leadsToQualifyThisWeek: 0,
        leadsToQualifyLastWeek: 0,
        callback: 0,
        callbackThisWeek: 0,
        callbackLastWeek: 0,
        appointmentSet: 0,
        appointmentThisWeek: 0,
        appointmentLastWeek: 0,
        sweep: 0,
        sweepThisWeek: 0,
        sweepLastWeek: 0,
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

  const journeyCardVariant = (key: string): 'slate' | 'violet' | 'blue' | 'emerald' | 'rose' => {
    switch (key) {
      case 'NO_CONTACT':
        return 'slate';
      case 'QUALIFIER_CALLBACK':
        return 'violet';
      case 'APPOINTMENT_SET':
        return 'blue';
      case 'SOLD':
        return 'emerald';
      case 'NOT_INTERESTED':
        return 'rose';
      default:
        return 'slate';
    }
  };

  if (queueView) {
    return (
      <QualifierDashboardQueueView
        kind={queueView}
        leads={leads}
        loading={loading}
        onBack={() => setQueueView(null)}
        onUpdated={loadLeads}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards — click to open queue with date + search */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QualifierSummaryCard
          title="Leads to Qualify"
          value={stats.leadsToQualify}
          icon={Users}
          change={formatWeekChange(stats.leadsToQualifyThisWeek, stats.leadsToQualifyLastWeek)}
          changeType={getChangeType(stats.leadsToQualifyThisWeek, stats.leadsToQualifyLastWeek)}
          variant="amber"
          onClick={() => setQueueView('qualify')}
        />
        <QualifierSummaryCard
          title="Callback"
          value={stats.callback}
          icon={PhoneCall}
          change={formatWeekChange(stats.callbackThisWeek, stats.callbackLastWeek)}
          changeType={getChangeType(stats.callbackThisWeek, stats.callbackLastWeek)}
          variant="violet"
          onClick={() => setQueueView('callback')}
        />
        <QualifierSummaryCard
          title="Appointment Set"
          value={stats.appointmentSet}
          icon={Calendar}
          change={formatWeekChange(stats.appointmentThisWeek, stats.appointmentLastWeek)}
          changeType={getChangeType(stats.appointmentThisWeek, stats.appointmentLastWeek)}
          variant="blue"
          onClick={() => setQueueView('appointment')}
        />
        <QualifierSummaryCard
          title="Sweep"
          value={stats.sweep}
          icon={Wind}
          change={formatWeekChange(stats.sweepThisWeek, stats.sweepLastWeek)}
          changeType={getChangeType(stats.sweepThisWeek, stats.sweepLastWeek)}
          variant="rose"
          onClick={() => setQueueView('sweep')}
        />
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="calendar">Appointment Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {QUALIFIER_JOURNEY_STAGES.map((stage) => {
              const count = leads.filter((l) => l.status === stage.key).length;
              const qk = queueKindForJourneyStage(stage.key);
              if (!qk) return null;
              const Icon = stage.icon;
              return (
                <QualifierSummaryCard
                  key={stage.key}
                  title={stage.label}
                  value={count}
                  icon={Icon}
                  variant={journeyCardVariant(stage.key)}
                  onClick={() => setQueueView(qk)}
                />
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <GoogleCalendarEmbed title="Appointment calendar" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
