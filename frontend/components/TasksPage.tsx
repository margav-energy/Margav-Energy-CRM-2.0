import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { SummaryCard } from './SummaryCard';
import { CheckSquare, Clock, Phone, Mail, Calendar, Plus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { createTask, getLeadActivity, getLeads, getMe, getTasks, updateTaskStatus } from '../lib/api';
import { toast } from 'react-toastify';
interface TaskRow {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  priority: string;
  status: string;
  dueDate: string;
  lead?: { id: string; firstName: string; lastName: string } | null;
  assignedToUser?: { id: string; fullName: string } | null;
}

type ActivityRow =
  | {
      id: string;
      type: 'status_change';
      createdAt?: string;
      fromStatus?: string | null;
      toStatus?: string;
      changedBy?: { fullName?: string };
      note?: string;
    }
  | { id: string; type: 'sms'; createdAt?: string; direction?: string; body?: string }
  | { id: string; type: 'activity'; createdAt?: string; eventType?: string; metadata?: Record<string, unknown> }
  | { id: string; type: 'note'; createdAt?: string; content?: string; createdBy?: { fullName?: string } }
  | { id: string; type: 'task'; createdAt?: string; title?: string; status?: string; dueDate?: string; assignedTo?: { fullName?: string } }
  | { id: string; type: 'call'; createdAt?: string; outcome?: string; notes?: string; createdBy?: { fullName?: string } };

function toHumanLabel(value: string | undefined | null): string {
  if (!value) return '—';
  return value
    .toString()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function formatActivityMessage(activity: ActivityRow): string {
  if (activity.type === 'status_change') {
    const actor = activity.changedBy?.fullName || 'User';
    const from = activity.fromStatus ? toHumanLabel(activity.fromStatus) : 'Unknown';
    const to = activity.toStatus ? toHumanLabel(activity.toStatus) : 'Updated';
    const note = activity.note?.trim() ? ` (${activity.note.trim()})` : '';
    return `${actor} changed status from ${from} to ${to}${note}`;
  }
  if (activity.type === 'sms') {
    const direction = activity.direction === 'INBOUND' ? 'Incoming SMS' : 'Outgoing SMS';
    const body = activity.body?.trim();
    return body ? `${direction}: ${body}` : direction;
  }
  if (activity.type === 'note') {
    const author = activity.createdBy?.fullName || 'User';
    const content = activity.content?.trim();
    return content ? `${author} added a note: ${content}` : `${author} added a note`;
  }
  if (activity.type === 'task') {
    const title = activity.title?.trim() || 'Task updated';
    const status = activity.status ? ` (${toHumanLabel(activity.status)})` : '';
    return `${title}${status}`;
  }
  if (activity.type === 'call') {
    const by = activity.createdBy?.fullName ? ` by ${activity.createdBy.fullName}` : '';
    const outcome = activity.outcome ? toHumanLabel(activity.outcome) : 'Call logged';
    const notes = activity.notes?.trim() ? ` - ${activity.notes.trim()}` : '';
    return `Call${by}: ${outcome}${notes}`;
  }
  const event = activity.eventType ? toHumanLabel(activity.eventType) : 'Activity event';
  const metadata = activity.metadata ?? {};
  const messageCandidate =
    (typeof metadata.message === 'string' && metadata.message) ||
    (typeof metadata.title === 'string' && metadata.title) ||
    (typeof metadata.action === 'string' && metadata.action) ||
    (typeof metadata.outcome === 'string' && metadata.outcome) ||
    (typeof metadata.status === 'string' && metadata.status) ||
    (typeof metadata.note === 'string' && metadata.note) ||
    (typeof metadata.details === 'string' && metadata.details) ||
    '';
  const message = messageCandidate ? `: ${messageCandidate}` : '';
  return `${event}${message}`;
}

const taskTypeIcons = {
  CALL: Phone,
  EMAIL: Mail,
  APPOINTMENT: Calendar,
  FOLLOW_UP: Clock,
  PROPOSAL: CheckSquare,
};

export function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [leads, setLeads] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [activityLeadId, setActivityLeadId] = useState<string>('all');
  const [activities, setActivities] = useState<Array<{ id: string; action: string; createdAt: string }>>([]);

  const [draftLeadId, setDraftLeadId] = useState('');
  const [draftTaskType, setDraftTaskType] = useState('CALL');
  const [draftPriority, setDraftPriority] = useState('MEDIUM');
  const [draftDueDate, setDraftDueDate] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTasks = async (assignedToUserId: string) => {
    setLoading(true);
    try {
      const res = await getTasks({ assignedToUserId, pageSize: 100 });
      setTasks((res.items as TaskRow[]) ?? []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setCurrentUserId(me.id);
        await loadTasks(me.id);
      } catch {
        setTasks([]);
      }
      try {
        const res = await getLeads({ pageSize: 200 });
        setLeads(((res.items ?? []) as Array<{ id: string; firstName: string; lastName: string }>).map((l) => ({ id: l.id, firstName: l.firstName, lastName: l.lastName })));
      } catch {
        setLeads([]);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const targetLeadId =
          activityLeadId !== 'all'
            ? activityLeadId
            : tasks.find((t) => t.lead?.id)?.lead?.id;
        if (!targetLeadId) {
          setActivities([]);
          return;
        }
        const rows = (await getLeadActivity(targetLeadId)) as ActivityRow[];
        setActivities(
          (rows ?? []).map((r) => ({
            id: r.id,
            action: formatActivityMessage(r),
            createdAt: r.createdAt ?? new Date().toISOString(),
          }))
        );
      } catch {
        setActivities([]);
      }
    })();
  }, [activityLeadId, tasks]);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const leadName = task.lead ? `${task.lead.firstName} ${task.lead.lastName}` : 'Unlinked';
        const matchesSearch =
          leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (task.description ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        const matchesType = typeFilter === 'all' || task.type === typeFilter;
        const assigneeName = task.assignedToUser?.fullName ?? 'Unassigned';
        const matchesAssignee = assigneeFilter === 'all' || assigneeName === assigneeFilter;
        return matchesSearch && matchesStatus && matchesType && matchesAssignee;
      }),
    [assigneeFilter, searchTerm, statusFilter, tasks, typeFilter]
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'OVERDUE': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-slate-100 text-slate-700';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleTaskStatus = async (task: TaskRow) => {
    const nextStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      await updateTaskStatus(task.id, nextStatus);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
      toast.success(`Task marked as ${nextStatus.toLowerCase().replace('_', ' ')}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update task status');
    }
  };

  const pendingTasks = tasks.filter(task => task.status === 'PENDING' || task.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED');
  const overdueTasks = tasks.filter(task => task.status === 'OVERDUE');

  const uniqueAssignees = [...new Set(tasks.map(task => task.assignedToUser?.fullName ?? 'Unassigned'))];

  const createNewTask = async () => {
    if (!currentUserId || !draftDueDate || !draftLeadId) return;
    setSaving(true);
    try {
      const lead = leads.find((l) => l.id === draftLeadId);
      await createTask({
        title: `${toHumanLabel(draftTaskType)} — ${lead ? `${lead.firstName} ${lead.lastName}` : 'Lead'}`,
        description: draftDescription.trim() || undefined,
        type: draftTaskType,
        priority: draftPriority,
        dueDate: new Date(draftDueDate).toISOString(),
        assignedToUserId: currentUserId,
        leadId: draftLeadId,
      });
      toast.success('Task created');
      setShowCreateTask(false);
      setDraftLeadId('');
      setDraftTaskType('CALL');
      setDraftPriority('MEDIUM');
      setDraftDueDate('');
      setDraftDescription('');
      await loadTasks(currentUserId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 rounded-3xl border border-slate-200/70 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-5 shadow-sm">
      <div className="rounded-2xl border border-white/70 bg-white/60 p-4 backdrop-blur-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks & Activities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track pending actions, complete follow-ups, and review live lead activities.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Tasks Pending"
          value={pendingTasks.length}
          icon={Clock}
          change={`${overdueTasks.length} overdue`}
          changeType={overdueTasks.length > 0 ? 'negative' : 'neutral'}
        />
        <SummaryCard
          title="Tasks Completed Today"
          value={completedTasks.length}
          icon={CheckSquare}
          change="Completed tasks"
          changeType="positive"
        />
        <SummaryCard
          title="High Priority"
          value={tasks.filter(t => t.priority === 'HIGH' && t.status !== 'COMPLETED').length}
          icon={Phone}
          change="Needs attention"
          changeType="neutral"
        />
        <SummaryCard
          title="This Week"
          value={tasks.filter(t => {
            const d = new Date(t.dueDate);
            const now = new Date();
            const seven = new Date();
            seven.setDate(now.getDate() + 7);
            return d >= now && d <= seven;
          }).length}
          icon={Calendar}
          change="Due this week"
          changeType="neutral"
        />
      </div>

      <Card className="rounded-2xl border-white/70 bg-white/65 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Tasks & Activities</CardTitle>
            <div className="flex items-center gap-2">
            <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
              <DialogTrigger asChild>
                <Button className="bg-indigo-600 text-white hover:bg-indigo-500">
                  <Plus className="w-4 h-4 mr-2" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="taskLead">Lead</Label>
                    <Select value={draftLeadId} onValueChange={setDraftLeadId}>
                      <SelectTrigger id="taskLead">
                        <SelectValue placeholder="Select lead" />
                      </SelectTrigger>
                      <SelectContent>
                        {leads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id}>
                            {lead.firstName} {lead.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="taskType">Task Type</Label>
                      <Select value={draftTaskType} onValueChange={setDraftTaskType}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CALL">Call</SelectItem>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="APPOINTMENT">Appointment</SelectItem>
                          <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                          <SelectItem value="PROPOSAL">Proposal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="taskPriority">Priority</Label>
                      <Select value={draftPriority} onValueChange={setDraftPriority}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="LOW">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="taskDueDate">Due Date</Label>
                      <Input type="datetime-local" id="taskDueDate" value={draftDueDate} onChange={(e) => setDraftDueDate(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="taskAssignee">Assign To</Label>
                      <Input id="taskAssignee" disabled value="You" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="taskDescription">Description</Label>
                    <Textarea id="taskDescription" placeholder="Task description..." value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreateTask(false)}>
                      Cancel
                    </Button>
                    <Button 
                      className="bg-indigo-600 text-white hover:bg-indigo-500"
                      onClick={createNewTask}
                      disabled={saving || !draftLeadId || !draftDueDate}
                    >
                      {saving ? 'Creating...' : 'Create Task'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="CALL">Call</SelectItem>
                <SelectItem value="EMAIL">Email</SelectItem>
                <SelectItem value="APPOINTMENT">Appointment</SelectItem>
                <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                <SelectItem value="PROPOSAL">Proposal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {uniqueAssignees.map(assignee => (
                  <SelectItem key={assignee} value={assignee}>{assignee}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>

          {/* Tasks Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/80">
                  <TableHead className="w-12">Done</TableHead>
                  <TableHead>Lead Name</TableHead>
                  <TableHead>Task Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      Loading tasks...
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No tasks found.
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.map((task) => {
                  const TaskIcon = taskTypeIcons[task.type as keyof typeof taskTypeIcons] ?? CheckSquare;
                  const leadName = task.lead
                    ? `${task.lead.firstName} ${task.lead.lastName}`
                    : (task.title?.includes('—') ? task.title.split('—')[1]?.trim() : task.title) || 'Unlinked Lead';
                  return (
                    <TableRow key={task.id} className="hover:bg-indigo-50/40 transition-colors">
                      <TableCell>
                        <Checkbox
                          checked={task.status === 'COMPLETED'}
                          onCheckedChange={() => toggleTaskStatus(task)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{leadName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TaskIcon className="w-4 h-4" />
                          {toHumanLabel(task.type)}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{task.description ?? task.title}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(task.dueDate).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(task.status)}>
                          {toHumanLabel(task.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.assignedToUser?.fullName ?? 'Unassigned'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-white/70 bg-white/65 shadow-sm backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Recent Activities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Label htmlFor="activityLead">Lead</Label>
            <Select value={activityLeadId} onValueChange={setActivityLeadId}>
              <SelectTrigger id="activityLead" className="w-[280px]">
                <SelectValue placeholder="Select lead for activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Auto (from tasks)</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.firstName} {lead.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-white divide-y">
            {activities.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No activity available.</p>
            ) : (
              activities.slice(0, 10).map((a) => (
                <div key={a.id} className="p-4 text-sm">
                  <p className="font-medium text-slate-800">{a.action.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}