import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getAgentOutcomes, getAgentSummary } from '../lib/api';
import { Send, Target, TrendingUp } from 'lucide-react';

const GREEN_PALETTE = ['#166534', '#15803d', '#22c55e', '#4ade80', '#86efac'];

export function AgentReportsPage() {
  const [weeks, setWeeks] = useState(4);
  const [outcomes, setOutcomes] = useState<Array<{ name: string; value: number; fill: string }>>([]);
  const [summary, setSummary] = useState<{
    totalLeads: number;
    sentToQualifier: number;
    depositions: number;
    appointmentSet: number;
    inPipeline: number;
    conversionRate: number;
    byProductLine: { solar: number; heating: number; unspecified: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAgentOutcomes(weeks),
      getAgentSummary(weeks),
    ])
      .then(([o, s]) => {
        setOutcomes(o);
        setSummary(s);
      })
      .catch(() => {
        setOutcomes([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [weeks]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        <div className="h-64 bg-muted rounded-lg" />
        <div className="h-64 bg-muted rounded-lg" />
        <div className="h-80 bg-muted rounded-lg lg:col-span-2" />
      </div>
    );
  }

  const plCounts = summary?.byProductLine ?? { solar: 0, heating: 0, unspecified: 0 };
  const showProductLineBreakdown =
    summary != null && plCounts.solar + plCounts.heating + plCounts.unspecified > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">My Lead Performance</h2>
        <p className="text-sm text-muted-foreground">
          Lead outcomes and performance for leads you submitted to qualifiers.
        </p>
      </div>

      <div className="flex justify-end">
        <Select value={String(weeks)} onValueChange={(v) => setWeeks(parseInt(v, 10))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 1 week</SelectItem>
            <SelectItem value="2">Last 2 weeks</SelectItem>
            <SelectItem value="4">Last 4 weeks</SelectItem>
            <SelectItem value="8">Last 8 weeks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-green-200/60 bg-gradient-to-br from-white to-green-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Total Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-800">{summary.totalLeads}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200/60 bg-gradient-to-br from-white to-green-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4" />
                Sent to Qualifier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-800">{summary.sentToQualifier}</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200/60 bg-gradient-to-br from-white to-blue-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Appointments Set</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-800">{summary.appointmentSet}</p>
            </CardContent>
          </Card>
          <Card className="border-violet-200/60 bg-gradient-to-br from-white to-violet-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                In Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-violet-800">{summary.inPipeline}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {showProductLineBreakdown ? (
        <Card className="border-amber-200/60 bg-gradient-to-br from-white to-amber-50/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Leads by product line</CardTitle>
            <p className="text-xs text-muted-foreground">
              Counts for leads you submitted to qualifiers in this period (including unspecified legacy rows).
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Solar</span>
                <p className="text-xl font-semibold text-amber-900">{plCounts.solar}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Heating (boilers)</span>
                <p className="text-xl font-semibold text-sky-900">{plCounts.heating}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Unspecified</span>
                <p className="text-xl font-semibold text-slate-700">{plCounts.unspecified}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        {/* Lead Outcomes */}
        <Card className="border-green-200/60 bg-gradient-to-br from-white to-green-50/30">
          <CardHeader>
            <CardTitle className="text-green-800">Lead Outcomes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Status breakdown of leads you sent to qualifiers.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={outcomes}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {outcomes.map((entry, i) => (
                    <Cell key={i} fill={entry.fill || GREEN_PALETTE[i % GREEN_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'Leads']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
