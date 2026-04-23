import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Button } from '../ui/button';
import { History, Flag, UserRound, CheckCircle2, Truck, Handshake, CircleDot } from 'lucide-react';
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

const ACTION_STYLES: Record<string, string> = {
  STATUS_CHANGE: 'bg-amber-100 text-amber-700',
  ASSIGN: 'bg-cyan-100 text-cyan-700',
  CREATE: 'bg-emerald-100 text-emerald-700',
  STAGE_CHANGE: 'bg-violet-100 text-violet-700',
  SMS_TEMPLATE_EDIT: 'bg-indigo-100 text-indigo-700',
  UPDATE: 'bg-slate-100 text-slate-700',
};

const ACTION_ICONS: Record<string, typeof Flag> = {
  STATUS_CHANGE: Truck,
  ASSIGN: UserRound,
  CREATE: CheckCircle2,
  STAGE_CHANGE: Handshake,
  SMS_TEMPLATE_EDIT: Flag,
  UPDATE: UserRound,
};

function formatFriendlyDetail(entry: AuditLogEntry): string {
  const entity = entry.entityType.toLowerCase();
  const action = (ACTION_LABELS[entry.action] ?? entry.action).toLowerCase();

  if (entry.action === 'STATUS_CHANGE' && entry.newValue && typeof entry.newValue === 'object') {
    const nextStatus = String((entry.newValue as Record<string, unknown>).status ?? '').replaceAll('_', ' ');
    if (nextStatus) return `${entry.userName} changed the ${entity} status to ${nextStatus}.`;
  }

  if (entry.action === 'ASSIGN' && entry.metadata && typeof entry.metadata === 'object') {
    const assignee =
      (entry.metadata as Record<string, unknown>).assignedToName ??
      (entry.metadata as Record<string, unknown>).assigneeName;
    if (assignee) return `${entry.userName} assigned this ${entity} to ${String(assignee)}.`;
  }

  if (entry.action === 'CREATE') {
    return `${entry.userName} created this ${entity}.`;
  }

  if (entry.newValue) return `${entry.userName} made an ${action} update on this ${entity}.`;
  if (entry.oldValue) return `${entry.userName} updated this ${entity}.`;
  return `${entry.userName} performed ${action} on this ${entity}.`;
}

export function AuditTrailPage() {
  const [userFilter, setUserFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [log, setLog] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(10);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

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

  const getEntryKeywords = (entry: AuditLogEntry): string[] => {
    const base = new Set<string>();
    base.add(entry.entityType.toLowerCase());
    base.add(entry.action.toLowerCase());
    base.add((ACTION_LABELS[entry.action] ?? entry.action).toLowerCase());

    const metadataText = entry.metadata ? JSON.stringify(entry.metadata).toLowerCase() : '';
    const newValueText = entry.newValue ? JSON.stringify(entry.newValue).toLowerCase() : '';
    const oldValueText = entry.oldValue ? JSON.stringify(entry.oldValue).toLowerCase() : '';
    const blob = `${metadataText} ${newValueText} ${oldValueText}`;

    if (blob.includes('status')) base.add('status');
    if (blob.includes('not_interested')) base.add('not interested');
    if (blob.includes('assign')) base.add('assigned');
    if (blob.includes('appointment')) base.add('appointment');
    if (blob.includes('opportun')) base.add('opportunity');
    if (blob.includes('sms')) base.add('sms');
    if (blob.includes('template')) base.add('template');
    if (entry.entityType.toLowerCase() === 'lead') base.add('lead');

    return Array.from(base);
  };

  const keywordOptions = Array.from(
    new Set((loading ? [] : log).flatMap((entry) => getEntryKeywords(entry)))
  )
    .filter((k) => k.length > 1)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 16);

  const filteredLog =
    selectedKeywords.length === 0
      ? log
      : log.filter((entry) => {
          const keys = getEntryKeywords(entry);
          return selectedKeywords.some((k) => keys.includes(k));
        });

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords((prev) =>
      prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword]
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <Card className="rounded-2xl border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Audit Trail
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Chronological activity timeline across assignment, stage, and status events.
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
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Keyword filters</p>
            <div className="flex flex-wrap gap-2">
              {keywordOptions.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => toggleKeyword(keyword)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    selectedKeywords.includes(keyword)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <span className="mr-1">{selectedKeywords.includes(keyword) ? '✓' : '○'}</span>
                  {keyword}
                </button>
              ))}
              {selectedKeywords.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedKeywords([])}
                  className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-600"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            {(loading ? [] : filteredLog).map((entry) => {
              const actionLabel = ACTION_LABELS[entry.action] ?? entry.action;
              const actionClass = ACTION_STYLES[entry.action] ?? 'bg-slate-100 text-slate-700';
              return (
                <div key={entry.id} className="relative pl-10">
                  <div className="absolute left-4 top-0 h-full w-px bg-slate-200" />
                  <div className="absolute left-[8px] top-4 z-10 rounded-full border border-slate-300 bg-slate-50 p-1.5">
                    <CircleDot className="h-3.5 w-3.5 text-indigo-500" />
                  </div>
                  <div className="rounded-xl border bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{entry.userName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionClass}`}>
                        {actionLabel}
                      </span>
                      <span className="text-muted-foreground">{entry.entityType}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                      {formatFriendlyDetail(entry)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {loading && (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
          )}
          {!loading && filteredLog.length === 0 && (
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
