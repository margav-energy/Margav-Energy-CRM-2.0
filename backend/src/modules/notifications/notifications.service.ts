import { prisma } from '../../db';
import { LeadStatus, Role } from '@prisma/client';
import { getAdminOperationalAlerts } from '../admin/admin.service';

export interface NotificationItem {
  id: string;
  type: 'task' | 'lead' | 'appointment' | 'ops';
  title: string;
  message: string;
  createdAt: string;
  link?: string;
  /** Human-readable place to fix the issue (matches app nav). */
  path?: string;
  priority: 'high' | 'medium' | 'low';
}

/** Label for `link` so notifications show where to go without reading route ids. */
export function notificationPathLabel(link: string | undefined): string | undefined {
  if (!link) return undefined;
  const labels: Record<string, string> = {
    '/tasks': 'Tasks / Activities',
    '/leads': 'Leads',
    '/dashboard': 'Dashboard',
    '/appointments': 'Appointments',
    '/admin-leads': 'Admin → Lead Operations',
    '/admin-appointments': 'Admin → Appointments',
    '/admin-sms': 'Admin → SMS Automation',
    '/admin-overview': 'Admin → Overview',
    '/opportunities': 'Opportunities',
    '/calendar': 'Calendar',
    '/reports': 'Reports / Analytics',
  };
  if (labels[link]) return labels[link];
  const trimmed = link.replace(/^\//, '');
  return trimmed ? trimmed.replace(/-/g, ' ') : undefined;
}

function adminOpsAlertLink(action: string | undefined): string {
  switch (action) {
    case 'view':
    case 'assign':
      return '/admin-leads';
    case 'set_appt':
      return '/admin-appointments';
    case 'view_tasks':
      return '/tasks';
    case 'inspect':
      return '/admin-sms';
    default:
      return '/admin-overview';
  }
}

export async function getNotificationsForUser(userId: string, userRole: Role): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const recentLeadCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Pending/overdue tasks assigned to user
  const tasks = await prisma.task.findMany({
    where: {
      assignedToUserId: userId,
      status: { in: ['PENDING', 'OVERDUE'] },
    },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 10,
  });

  for (const task of tasks) {
    const due = new Date(task.dueDate);
    const isOverdue = due < now;
    const leadName = task.lead
      ? `${task.lead.firstName} ${task.lead.lastName}`.trim()
      : 'Task';
    items.push({
      id: `task-${task.id}`,
      type: 'task',
      title: isOverdue ? 'Overdue task' : 'Task due',
      message: `${task.title} – ${leadName}`,
      createdAt: task.dueDate.toISOString(),
      link: `/tasks`,
      path: notificationPathLabel('/tasks'),
      priority: isOverdue ? 'high' : task.priority === 'HIGH' ? 'high' : 'medium',
    });
  }

  // Role-specific: leads
  if (userRole === 'AGENT') {
    const recentAssignedLeads = await prisma.lead.findMany({
      where: {
        assignedAgentId: userId,
        createdAt: { gte: recentLeadCutoff },
      },
      select: { id: true, firstName: true, lastName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const lead of recentAssignedLeads) {
      const leadName = `${lead.firstName} ${lead.lastName}`.trim();
      items.push({
        id: `agent-new-lead-${lead.id}`,
        type: 'lead',
        title: 'New lead assigned',
        message: `${leadName} was assigned to you`,
        createdAt: lead.createdAt.toISOString(),
        link: '/leads',
        path: notificationPathLabel('/leads'),
        priority: 'medium',
      });
    }

    const newLeads = await prisma.lead.count({
      where: {
        assignedAgentId: userId,
        status: LeadStatus.NEW,
        createdAt: { gte: recentLeadCutoff },
      },
    });
    if (newLeads > 0) {
      items.push({
        id: `agent-new-leads-${userId}`,
        type: 'lead',
        title: 'New leads assigned',
        message: `${newLeads} new lead${newLeads !== 1 ? 's' : ''} assigned to you`,
        createdAt: now.toISOString(),
        link: '/leads',
        path: notificationPathLabel('/leads'),
        priority: 'medium',
      });
    }
  }

  if (userRole === 'QUALIFIER') {
    const recentQualifierLeads = await prisma.lead.findMany({
      where: {
        createdAt: { gte: recentLeadCutoff },
        OR: [{ assignedQualifierId: userId }, { qualifiedByQualifierId: userId }],
      },
      select: { id: true, firstName: true, lastName: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const lead of recentQualifierLeads) {
      const leadName = `${lead.firstName} ${lead.lastName}`.trim();
      items.push({
        id: `qualifier-new-lead-${lead.id}`,
        type: 'lead',
        title: 'New lead to review',
        message: `${leadName} is now in your queue (${lead.status.replace(/_/g, ' ')})`,
        createdAt: lead.createdAt.toISOString(),
        link: '/dashboard',
        path: notificationPathLabel('/dashboard'),
        priority: 'high',
      });
    }

    const toQualify = await prisma.lead.count({
      where: {
        status: LeadStatus.QUALIFYING,
        OR: [
          { assignedQualifierId: userId },
          { source: 'Agent', assignedQualifierId: null },
        ],
      },
    });
    if (toQualify > 0) {
      items.push({
        id: `qualifier-pending-${userId}`,
        type: 'lead',
        title: 'Leads to qualify',
        message: `${toQualify} lead${toQualify !== 1 ? 's' : ''} sent to qualify`,
        createdAt: now.toISOString(),
        link: '/dashboard',
        path: notificationPathLabel('/dashboard'),
        priority: 'high',
      });
    }
  }

  // Upcoming appointments (for qualifiers and field sales)
  if (userRole === 'QUALIFIER' || userRole === 'FIELD_SALES') {
    const appointments = await prisma.appointment.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gte: now, lte: todayEnd },
      },
      include: {
        lead: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    });
    for (const apt of appointments) {
      const leadName = apt.lead ? `${apt.lead.firstName} ${apt.lead.lastName}`.trim() : 'Lead';
      items.push({
        id: `appt-${apt.id}`,
        type: 'appointment',
        title: 'Appointment today',
        message: `${leadName} – ${new Date(apt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        createdAt: apt.scheduledAt.toISOString(),
        link: '/appointments',
        path: notificationPathLabel('/appointments'),
        priority: 'high',
      });
    }
  }

  if (userRole === Role.ADMIN) {
    const opsAlerts = await getAdminOperationalAlerts();
    const ts = now.toISOString();
    for (const a of opsAlerts) {
      const firstAction = a.actions[0]?.action;
      const link = adminOpsAlertLink(firstAction);
      items.push({
        id: `admin-ops-${a.type}`,
        type: 'ops',
        title: a.title,
        message: `${a.count} item${a.count !== 1 ? 's' : ''} need attention`,
        createdAt: ts,
        link,
        path: notificationPathLabel(link),
        priority: a.severity,
      });
    }
  }

  // Sort by priority (high first) then by createdAt
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => {
    const p = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (p !== 0) return p;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return items.slice(0, 20);
}
