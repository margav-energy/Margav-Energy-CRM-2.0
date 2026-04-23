import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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
} from 'recharts';
import {
  getReportsFunnel,
  getProductMix,
  getMonthlyTrends,
  getRepPerformance,
  getLeadProductLines,
} from '../lib/api';

const GREEN_PALETTE = ['#166534', '#15803d', '#22c55e', '#4ade80', '#86efac'];

type RepPerfRow = {
  id: string;
  name: string;
  role: string;
  calls: number;
  leads: number;
  appointments: number;
  sales: number;
  revenue: number;
  conversionRate: number;
};

function CRMAnalyticsTab() {
  const [months, setMonths] = useState(6);
  const [funnel, setFunnel] = useState<Array<{ name: string; value: number }>>([]);
  const [productMix, setProductMix] = useState<Array<{ name: string; value: number; revenue: number; color: string }>>([]);
  const [leadProductLines, setLeadProductLines] = useState<Array<{ name: string; value: number; fill: string }>>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<Array<{ month: string; leads: number; appointments: number; sales: number; revenue: number }>>([]);
  const [repPerf, setRepPerf] = useState<RepPerfRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getReportsFunnel(months),
      getProductMix(months),
      getMonthlyTrends(months),
      getRepPerformance(months),
      getLeadProductLines({ months }),
    ])
      .then(([f, p, m, r, pl]) => {
        setFunnel(f);
        setProductMix(p);
        setMonthlyTrends(m);
        setRepPerf(r);
        setLeadProductLines(pl);
      })
      .catch(() => {
        setFunnel([]);
        setProductMix([]);
        setMonthlyTrends([]);
        setRepPerf([]);
        setLeadProductLines([]);
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-3">
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
            <p className="text-sm text-muted-foreground font-normal">Closed-won opportunities by bundle type.</p>
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

        <Card>
          <CardHeader>
            <CardTitle>Lead pipeline by business line</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">Solar vs heating for leads in your CRM scope (not sales revenue).</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={leadProductLines}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {leadProductLines.map((entry, i) => (
                    <Cell key={i} fill={entry.fill || GREEN_PALETTE[i % GREEN_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'Leads']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
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

        <Card className="lg:col-span-3">
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
                    <tr key={rep.id} className="border-b hover:bg-muted/50">
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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">CRM Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Funnel, revenue, and trends for your role. Qualifiers only see their own pipeline and outcomes.
        </p>
      </header>
      <CRMAnalyticsTab />
    </div>
  );
}
