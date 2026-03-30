import { useState, Fragment, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
import { Button } from '../ui/button';
import { History, ChevronDown, ChevronRight } from 'lucide-react';
import { getAdminAuditLog, getAdminUsers } from '../../lib/api';
import type { AuditLogEntry, AdminUser } from '../../lib/admin-types';

const ACTION_LABELS: Record<string, string> = {
  STATUS_CHANGE: 'Status Change',
  ASSIGN: 'Assign',
  CREATE: 'Create',
  STAGE_CHANGE: 'Stage Change',
  SMS_TEMPLATE_EDIT: 'SMS Template Edit',
  UPDATE: 'Update',
};

export function AuditTrailPage() {
  const [userFilter, setUserFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [log, setLog] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(25);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    getAdminUsers()
      .then((u) => setUsers(u as AdminUser[]))
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    getAdminAuditLog({
      page,
      pageSize,
      userId: userFilter === 'all' ? undefined : userFilter,
    })
      .then((res) => {
        setLog((res.items ?? []) as AuditLogEntry[]);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setLog([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, userFilter]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Audit Trail / Activity Log
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Lead status changes from the database (LeadStatusHistory). More entity types can be added later.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Select
              value={userFilter}
              onValueChange={(v) => {
                setUserFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {total} event{total === 1 ? '' : 's'}
            </span>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Entity ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(loading ? [] : log).map((entry) => (
                  <Fragment key={entry.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      <TableCell>
                        {expandedId === entry.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(entry.createdAt)}</TableCell>
                      <TableCell>{entry.userName}</TableCell>
                      <TableCell>{ACTION_LABELS[entry.action] ?? entry.action}</TableCell>
                      <TableCell>{entry.entityType}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.entityId}</TableCell>
                    </TableRow>
                    {expandedId === entry.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/50 p-4">
                          <div className="text-sm space-y-2">
                            {entry.metadata != null && (
                              <div>
                                <span className="font-medium text-muted-foreground">Context: </span>
                                <code className="text-xs bg-background px-1 rounded">
                                  {String(JSON.stringify(entry.metadata))}
                                </code>
                              </div>
                            )}
                            {Boolean(entry.oldValue ?? entry.newValue) && (
                              <>
                                {entry.oldValue && (
                                  <div>
                                    <span className="font-medium text-muted-foreground">Old: </span>
                                    <code className="text-xs bg-background px-1 rounded">
                                      {String(JSON.stringify(entry.oldValue))}
                                    </code>
                                  </div>
                                )}
                                {entry.newValue && (
                                  <div>
                                    <span className="font-medium text-muted-foreground">New: </span>
                                    <code className="text-xs bg-background px-1 rounded">
                                      {String(JSON.stringify(entry.newValue))}
                                    </code>
                                  </div>
                                )}
                              </>
                            )}
                            {!entry.oldValue && !entry.newValue && entry.metadata == null && (
                              <span className="text-muted-foreground">No additional details</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {loading && (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
          )}
          {!loading && log.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">No audit events yet.</div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
