import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts';
import {
  getWeeklyLeadPerformance,
  getWeeklyFunnel,
  getAppointmentOutcomes,
  getReportsFunnel,
  getProductMix,
  getMonthlyTrends,
  getRepPerformance,
} from '../lib/api';

const GREEN_PALETTE = ['#166534', '#15803d', '#22c55e', '#4ade80', '#86efac'];

function WeeklyReportsTab() {
  const [weeks, setWeeks] = useState(1);
  const [leadPerf, setLeadPerf] = useState<Array<{ name: string; value: number; fill: string }>>([]);
  const [funnel, setFunnel] = useState<Array<{ name: string; value: number; fill: string }>>([]);
  const [apptOutcomes, setApptOutcomes] = useState<Array<{ name: string; value: number; fill: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getWeeklyLeadPerformance(weeks),
      getWeeklyFunnel(weeks),
      getAppointmentOutcomes(Math.max(weeks, 4)),
    ])
      .then(([lp, f, ao]) => {
        setLeadPerf(lp);
        setFunnel(f);
        setApptOutcomes(ao);
      })
      .catch(() => {
        setLeadPerf([]);
        setFunnel([]);
        setApptOutcomes([]);
      })
      .finally(() => setLoading(false));
  }, [weeks]);

  const deadLeads = (leadPerf.find((x) => x.name === 'Not Interested')?.value ?? 0) +
    (leadPerf.find((x) => x.name === 'Wrong Number')?.value ?? 0) +
    (leadPerf.find((x) => x.name === 'DNQ')?.value ?? 0);
  const appointmentBooked = leadPerf.find((x) => x.name === 'Appointment Booked')?.value ?? 0;
  const totalLeads = leadPerf.reduce((s, x) => s + x.value, 0);
  const appointmentPct = totalLeads > 0 ? Math.round((appointmentBooked / totalLeads) * 100) : 0;
  const callbackCount = leadPerf.find((x) => x.name === 'Call Back')?.value ?? 0;

  const funnelTotal = funnel[0]?.value ?? 0;
  const funnelAppts = funnel[3]?.value ?? 0;
  const aimAppts = 10;
  const notInterestedPct = totalLeads > 0
    ? Math.round(((leadPerf.find((x) => x.name === 'Not Interested')?.value ?? 0) / totalLeads) * 100)
    : 0;
  const wrongNumberPct = totalLeads > 0
    ? Math.round(((leadPerf.find((x) => x.name === 'Wrong Number')?.value ?? 0) / totalLeads) * 100)
    : 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        <div className="h-80 bg-muted rounded-lg" />
        <div className="h-80 bg-muted rounded-lg" />
        <div className="h-80 bg-muted rounded-lg" />
        <div className="h-80 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={String(weeks)} onValueChange={(v) => setWeeks(parseInt(v, 10))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 1 week</SelectItem>
            <SelectItem value="2">Last 2 weeks</SelectItem>
            <SelectItem value="4">Last 4 weeks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Lead Performance */}
        <Card className="border-green-200/60 bg-gradient-to-br from-white to-green-50/30">
          <CardHeader>
            <CardTitle className="text-green-800">Weekly Lead Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={leadPerf} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [value, 'Leads']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {leadPerf.map((entry, i) => (
                    <Cell key={i} fill={GREEN_PALETTE[i % GREEN_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 p-3 rounded-lg bg-green-50/80 border border-green-100 text-sm text-green-800">
              The graph shows <strong>{deadLeads} leads are now &apos;dead&apos;</strong>, with{' '}
              <strong>{appointmentPct}%</strong> showing at &apos;Appointment Booked&apos;. There are still{' '}
              <strong>{callbackCount} callback opportunities</strong> which may help push additional positive results.
            </div>
          </CardContent>
        </Card>

        {/* Lead-to-Appointment Conversion */}
        <Card className="border-green-200/60 bg-gradient-to-br from-white to-green-50/30">
          <CardHeader>
            <CardTitle className="text-green-800">Lead-to-Appointment Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative w-48 h-48">
                <PieChart width={192} height={192}>
                  <Pie
                    data={
                      totalLeads === 0
                        ? [{ name: 'No data', value: 1, fill: '#e5e7eb' }]
                        : [
                            { name: 'Appointments Booked', value: appointmentBooked, fill: '#22c55e' },
                            { name: 'Other outcomes', value: Math.max(0, totalLeads - appointmentBooked), fill: '#e5e7eb' },
                          ].filter((d) => d.value > 0)
                    }
                    cx={96}
                    cy={96}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  />
                </PieChart>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-green-800">{appointmentPct}%</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground text-center max-w-xs">
                {appointmentBooked} of {totalLeads} leads reached &apos;Appointment Booked&apos;. Based on CRM disposition data.
              </p>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-green-50/80 border border-green-100 text-sm text-green-800">
              Conversion rate improves as more appointments are set and callbacks are followed up.
            </div>
          </CardContent>
        </Card>

        {/* Leads Funnel */}
        <Card className="border-green-200/60 bg-gradient-to-br from-white to-green-50/30 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-green-800">Leads Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8 flex-wrap">
              <div className="flex-1 min-w-[280px]">
                <ResponsiveContainer width="100%" height={220}>
                  <FunnelChart>
                    <Funnel dataKey="value" data={funnel} isAnimationActive={false}>
                      <LabelList position="center" fill="#fff" stroke="none" dataKey="value" />
                      {funnel.map((entry, i) => (
                        <Cell key={i} fill={entry.fill || GREEN_PALETTE[i % GREEN_PALETTE.length]} />
                      ))}
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-[200px] space-y-4">
                <div className="p-3 rounded-lg bg-green-50/80 border border-green-100">
                  <p className="text-xs font-medium text-green-700 uppercase">Aim</p>
                  <p className="text-sm text-green-800">10 appointments in 50 leads</p>
                  <p className="text-sm font-medium text-green-800 mt-1">Actual: {funnelAppts} appointments</p>
                </div>
                <div className="p-3 rounded-lg bg-green-50/80 border border-green-100">
                  <p className="text-xs font-medium text-green-700 uppercase">Approach</p>
                  <p className="text-sm text-green-800">
                    Continue cycling through remaining leads marked as &apos;No Contact&apos; and &apos;Callback&apos; to maximise additional booking opportunities.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-100">
                  <p className="text-xs font-medium text-amber-700 uppercase">Key Challenges</p>
                  <p className="text-sm text-amber-800">{notInterestedPct}% of leads were Not Interested.</p>
                  <p className="text-sm text-amber-800">{wrongNumberPct}% of leads contained incorrect phone numbers.</p>
                  <p className="text-sm text-amber-800 mt-1">These factors limited additional conversion opportunities but there are still leads available in the pipeline.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointment Outcomes */}
        <Card className="border-green-200/60 bg-gradient-to-br from-white to-green-50/30 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-green-800">Appointment Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8 flex-wrap items-center">
              <ResponsiveContainer width="100%" height={220} className="max-w-[280px]">
                <PieChart>
                  <Pie
                    data={apptOutcomes}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ value }) => value}
                  >
                    {apptOutcomes.map((entry, i) => (
                      <Cell key={i} fill={entry.fill || GREEN_PALETTE[i % GREEN_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, '']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 flex-wrap">
                {apptOutcomes.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: entry.fill || GREEN_PALETTE[i % GREEN_PALETTE.length] }}
                    />
                    <span className="text-sm">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CRMAnalyticsTab() {
  const [months, setMonths] = useState(6);
  const [funnel, setFunnel] = useState<Array<{ name: string; value: number }>>([]);
  const [productMix, setProductMix] = useState<Array<{ name: string; value: number; revenue: number; color: string }>>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<Array<{ month: string; leads: number; appointments: number; sales: number; revenue: number }>>([]);
  const [repPerf, setRepPerf] = useState<Array<{ name: string; calls: number; leads: number; appointments: number; sales: number; revenue: number; conversionRate: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getReportsFunnel(months),
      getProductMix(months),
      getMonthlyTrends(months),
      getRepPerformance(months),
    ])
      .then(([f, p, m, r]) => {
        setFunnel(f);
        setProductMix(p);
        setMonthlyTrends(m);
        setRepPerf(r);
      })
      .catch(() => {
        setFunnel([]);
        setProductMix([]);
        setMonthlyTrends([]);
        setRepPerf([]);
      })
      .finally(() => setLoading(false));
  }, [months]);

  const totalRevenue = productMix.reduce((s, x) => s + x.revenue, 0);
  const totalDeals = productMix.reduce((s, x) => s + x.value, 0);
  const conversionRate =
    funnel.length > 0 && funnel[0].value > 0
      ? ((funnel[funnel.length - 1]?.value ?? 0) / funnel[0].value * 100).toFixed(1)
      : '0';

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        <div className="h-80 bg-muted rounded-lg" />
        <div className="h-80 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Select value={String(months)} onValueChange={(v) => setMonths(parseInt(v, 10))}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">£{(totalRevenue / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{conversionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deals Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalDeals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{funnel[0]?.value ?? 0} leads</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnel} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value: number) => [value, 'Count']} />
                <Bar dataKey="value" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={productMix}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {productMix.map((entry, i) => (
                    <Cell key={i} fill={entry.color || GREEN_PALETTE[i % GREEN_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, _name: string, props: { payload?: { revenue?: number } }) => {
                  const rev = props?.payload?.revenue ?? 0;
                  return [`${value} deals, £${(rev / 1000).toFixed(0)}k`, 'Product'];
                }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyTrends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="leads" fill="#22c55e" name="Leads" radius={[4, 4, 0, 0]} />
                <Bar dataKey="appointments" fill="#15803d" name="Appointments" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sales" fill="#166534" name="Sales" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales Rep Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Rep</th>
                    <th className="text-center p-2">Calls</th>
                    <th className="text-center p-2">Leads</th>
                    <th className="text-center p-2">Appointments</th>
                    <th className="text-center p-2">Sales</th>
                    <th className="text-center p-2">Revenue</th>
                    <th className="text-center p-2">Conv. %</th>
                  </tr>
                </thead>
                <tbody>
                  {repPerf.map((rep) => (
                    <tr key={rep.name} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{rep.name}</td>
                      <td className="text-center p-2">{rep.calls}</td>
                      <td className="text-center p-2">{rep.leads}</td>
                      <td className="text-center p-2">{rep.appointments}</td>
                      <td className="text-center p-2">{rep.sales}</td>
                      <td className="text-center p-2">£{(rep.revenue / 1000).toFixed(0)}k</td>
                      <td className="text-center p-2">{rep.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="weekly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="weekly">Weekly Reports</TabsTrigger>
          <TabsTrigger value="crm">CRM Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Lead performance and disposition outcomes from your CRM data. Qualifier call outcomes, lead status, and appointment results.
          </p>
          <WeeklyReportsTab />
        </TabsContent>

        <TabsContent value="crm" className="space-y-6">
          <CRMAnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
