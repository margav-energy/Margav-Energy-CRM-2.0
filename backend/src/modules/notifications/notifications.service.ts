import { prisma } from '../../db';
import { LeadStatus, Role } from '@prisma/client';

export interface NotificationItem {
  id: string;
  type: 'task' | 'lead' | 'appointment';
  title: string;
  message: string;
  createdAt: string;
  link?: string;
  priority: 'high' | 'medium' | 'low';
}

export async function getNotificationsForUser(userId: string, userRole: Role): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];
  const now = new Date();
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

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
      priority: isOverdue ? 'high' : task.priority === 'HIGH' ? 'high' : 'medium',
    });
  }

  // Role-specific: leads
  if (userRole === 'AGENT') {
    const newLeads = await prisma.lead.count({
      where: {
        assignedAgentId: userId,
        status: LeadStatus.NEW,
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
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
        priority: 'medium',
      });
    }
  }

  if (userRole === 'QUALIFIER') {
    const toQualify = await prisma.lead.count({
      where: { status: LeadStatus.QUALIFYING },
    });
    if (toQualify > 0) {
      items.push({
        id: `qualifier-pending-${userId}`,
        type: 'lead',
        title: 'Leads to qualify',
        message: `${toQualify} lead${toQualify !== 1 ? 's' : ''} sent to qualify`,
        createdAt: now.toISOString(),
        link: '/dashboard',
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
        priority: 'high',
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

  return items.slice(0, 15);
}
