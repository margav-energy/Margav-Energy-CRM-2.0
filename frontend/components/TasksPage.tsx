import React, { useState } from 'react';
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

interface Task {
  id: string;
  leadName: string;
  taskType: 'Call' | 'Email' | 'Meeting' | 'Follow-up' | 'Proposal';
  description: string;
  dueDate: string;
  status: 'Pending' | 'Completed' | 'Overdue';
  assignedTo: string;
  priority: 'High' | 'Medium' | 'Low';
}

const mockTasks: Task[] = [
  {
    id: '1',
    leadName: 'Sarah Johnson',
    taskType: 'Call',
    description: 'Follow up on initial interest in solar panels',
    dueDate: '2024-10-05',
    status: 'Pending',
    assignedTo: 'John Doe',
    priority: 'High'
  },
  {
    id: '2',
    leadName: 'Mike Chen',
    taskType: 'Email',
    description: 'Send proposal for battery system',
    dueDate: '2024-10-04',
    status: 'Overdue',
    assignedTo: 'John Doe',
    priority: 'High'
  },
  {
    id: '3',
    leadName: 'Emily Davis',
    taskType: 'Meeting',
    description: 'Home assessment appointment',
    dueDate: '2024-10-06',
    status: 'Pending',
    assignedTo: 'Mike Rodriguez',
    priority: 'Medium'
  },
  {
    id: '4',
    leadName: 'Robert Wilson',
    taskType: 'Follow-up',
    description: 'Check on financing approval status',
    dueDate: '2024-10-03',
    status: 'Completed',
    assignedTo: 'Sarah Kim',
    priority: 'Medium'
  },
  {
    id: '5',
    leadName: 'Lisa Anderson',
    taskType: 'Proposal',
    description: 'Prepare EV charger installation quote',
    dueDate: '2024-10-07',
    status: 'Pending',
    assignedTo: 'David Thompson',
    priority: 'Low'
  }
];

const taskTypeIcons = {
  'Call': Phone,
  'Email': Mail,
  'Meeting': Calendar,
  'Follow-up': Clock,
  'Proposal': CheckSquare
};

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [showCreateTask, setShowCreateTask] = useState(false);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.leadName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesType = typeFilter === 'all' || task.taskType === typeFilter;
    const matchesAssignee = assigneeFilter === 'all' || task.assignedTo === assigneeFilter;
    return matchesSearch && matchesStatus && matchesType && matchesAssignee;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleTaskStatus = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: task.status === 'Completed' ? 'Pending' : 'Completed' }
        : task
    ));
  };

  const pendingTasks = tasks.filter(task => task.status === 'Pending');
  const completedTasks = tasks.filter(task => task.status === 'Completed');
  const overdueTasks = tasks.filter(task => task.status === 'Overdue');

  const uniqueAssignees = [...new Set(tasks.map(task => task.assignedTo))];

  return (
    <div className="space-y-6">
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
          value={completedTasks.filter(t => t.dueDate === '2024-10-02').length}
          icon={CheckSquare}
          change="+3 from yesterday"
          changeType="positive"
        />
        <SummaryCard
          title="High Priority"
          value={tasks.filter(t => t.priority === 'High' && t.status !== 'Completed').length}
          icon={Phone}
          change="Needs attention"
          changeType="neutral"
        />
        <SummaryCard
          title="This Week"
          value={tasks.filter(t => t.dueDate >= '2024-10-02' && t.dueDate <= '2024-10-08').length}
          icon={Calendar}
          change="Due this week"
          changeType="neutral"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Tasks & Activities</CardTitle>
            <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
              <DialogTrigger asChild>
                <Button style={{ backgroundColor: 'var(--energy-blue)', color: 'white' }}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="taskLead">Lead Name</Label>
                    <Input id="taskLead" placeholder="Enter lead name" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="taskType">Task Type</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Call">Call</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Meeting">Meeting</SelectItem>
                          <SelectItem value="Follow-up">Follow-up</SelectItem>
                          <SelectItem value="Proposal">Proposal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="taskPriority">Priority</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="taskDueDate">Due Date</Label>
                      <Input type="date" id="taskDueDate" />
                    </div>
                    <div>
                      <Label htmlFor="taskAssignee">Assign To</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select assignee" />
                        </SelectTrigger>
                        <SelectContent>
                          {uniqueAssignees.map(assignee => (
                            <SelectItem key={assignee} value={assignee}>{assignee}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="taskDescription">Description</Label>
                    <Textarea id="taskDescription" placeholder="Task description..." />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreateTask(false)}>
                      Cancel
                    </Button>
                    <Button 
                      style={{ backgroundColor: 'var(--energy-blue)', color: 'white' }}
                      onClick={() => setShowCreateTask(false)}
                    >
                      Create Task
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Call">Call</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="Meeting">Meeting</SelectItem>
                <SelectItem value="Follow-up">Follow-up</SelectItem>
                <SelectItem value="Proposal">Proposal</SelectItem>
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

          {/* Tasks Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
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
                {filteredTasks.map((task) => {
                  const TaskIcon = taskTypeIcons[task.taskType];
                  return (
                    <TableRow key={task.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Checkbox
                          checked={task.status === 'Completed'}
                          onCheckedChange={() => toggleTaskStatus(task.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{task.leadName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TaskIcon className="w-4 h-4" />
                          {task.taskType}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{task.description}</TableCell>
                      <TableCell>{task.dueDate}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>{task.assignedTo}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}