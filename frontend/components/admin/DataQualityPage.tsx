import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { AlertTriangle, Merge, Phone, MapPin, FileWarning, DollarSign, User, Database } from 'lucide-react';
import { getDataQualityIssues } from '../../lib/api';
import type { DataQualityIssue } from '../../lib/admin-types';

const ISSUE_ICONS: Record<string, LucideIcon> = {
  duplicate_leads: Merge,
  duplicate_email: Merge,
  missing_phone: Phone,
  invalid_postcode: MapPin,
  incomplete_qualification: FileWarning,
  opportunities_missing_value: DollarSign,
  appointments_missing_rep: User,
  leads_missing_source: Database,
};

export function DataQualityPage() {
  const [issues, setIssues] = useState<DataQualityIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDataQualityIssues()
      .then((res) => setIssues((res.issues ?? []) as unknown as DataQualityIssue[]))
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">Loading data quality…</div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground">
            Counts from your live database. Use bulk tools from Lead Operations when you add workflows.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {issues.map((issue) => {
              const Icon = ISSUE_ICONS[issue.type] ?? AlertTriangle;
              return (
                <Card key={issue.type} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base">{issue.title}</CardTitle>
                      </div>
                      <Badge variant={issue.count > 0 ? 'destructive' : 'secondary'}>{issue.count}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-4">
                      {issue.groups
                        ? `Duplicate groups: ${issue.groups.length}. Example: ${issue.groups[0]?.key}`
                        : `${issue.ids.length} sample IDs loaded (max 100–200).`}
                    </p>
                    <Button size="sm" variant="outline" disabled>
                      {issue.type === 'duplicate_leads' || issue.type === 'duplicate_email'
                        ? 'Merge Wizard'
                        : 'Bulk Fix'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Resolution Workflows</CardTitle>
          <p className="text-sm text-muted-foreground">
            Merge duplicates wizard, set missing source, assign reps to appointments, etc. (wire these actions when
            backend endpoints are added).
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span>Merge duplicate leads (same phone/email)</span>
              <Button size="sm" variant="outline" disabled>
                Start Merge Wizard
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span>Set missing source for leads</span>
              <Button size="sm" variant="outline" disabled>
                Bulk Set Source
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span>Assign reps to appointments missing rep</span>
              <Button size="sm" variant="outline" disabled>
                Bulk Assign
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <span>Set estimated value for opportunities</span>
              <Button size="sm" variant="outline" disabled>
                Bulk Set Value
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
