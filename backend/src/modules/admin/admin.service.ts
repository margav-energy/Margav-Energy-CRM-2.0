/**
 * Admin Dashboard - aggregated metrics and data for admin views.
 */

import { prisma } from '../../db';
import { AppError } from '../../middleware/errorHandler';
import {
  LeadStatus,
  OpportunityStage,
  AppointmentStatus,
  Prisma,
  Role,
  ProductType,
  TaskPriority,
  TaskType,
} from '@prisma/client';

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const weekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
};

const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Previous calendar month [start, end) for comparisons */
function priorMonthRange() {
  const thisMonth = monthStart();
  const end = new Date(thisMonth);
  const start = new Date(thisMonth);
  start.setMonth(start.getMonth() - 1);
  return { start, end };
}

export async function getAdminOverview() {
  const today = todayStart();
  const week = weekStart();
  const month = monthStart();
  const { start: priorMonthStart, end: priorMonthEnd } = priorMonthRange();
  const yesterdayStart = new Date(today);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);

  const [
    newLeadsToday,
    newLeadsYesterday,
    leadsNotContacted5Min,
    leadsNotContacted15Min,
    leadsByStatus,
    appointmentsToday,
    appointmentsThisWeek,
    wonRevenueThisMonth,
    wonRevenuePriorMonth,
    lostOpportunitiesThisMonth,
    noShowCount,
    completedCount,
    pipelineValue,
    pipelineOpportunityCount,
    bookedViaSms,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: today } } }),
    prisma.lead.count({
      where: { createdAt: { gte: yesterdayStart, lt: today } },
    }),
    prisma.lead.count({
      where: {
        status: LeadStatus.NEW,
        createdAt: { lte: fiveMinAgo },
      },
    }),
    prisma.lead.count({
      where: {
        status: LeadStatus.NEW,
        createdAt: { lte: fifteenMinAgo },
      },
    }),
    prisma.lead.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.appointment.count({
      where: {
        scheduledAt: { gte: today },
        status: AppointmentStatus.SCHEDULED,
      },
    }),
    prisma.appointment.count({
      where: {
        scheduledAt: { gte: week },
        status: AppointmentStatus.SCHEDULED,
      },
    }),
    prisma.opportunity.aggregate({
      where: {
        stage: OpportunityStage.WON,
        createdAt: { gte: month },
      },
      _sum: { estimatedValue: true },
    }),
    prisma.opportunity.aggregate({
      where: {
        stage: OpportunityStage.WON,
        createdAt: { gte: priorMonthStart, lt: priorMonthEnd },
      },
      _sum: { estimatedValue: true },
    }),
    prisma.opportunity.count({
      where: {
        stage: OpportunityStage.LOST,
        createdAt: { gte: month },
      },
    }),
    prisma.appointment.count({
      where: {
        status: AppointmentStatus.NO_SHOW,
        scheduledAt: { gte: month },
      },
    }),
    prisma.appointment.count({
      where: {
        status: AppointmentStatus.COMPLETED,
        scheduledAt: { gte: month },
      },
    }),
    prisma.opportunity.aggregate({
      where: {
        stage: { in: [OpportunityStage.PITCH_SCHEDULED, OpportunityStage.PITCH_COMPLETED] },
      },
      _sum: { estimatedValue: true },
    }),
    prisma.opportunity.count({
      where: {
        stage: { in: [OpportunityStage.PITCH_SCHEDULED, OpportunityStage.PITCH_COMPLETED] },
      },
    }),
    prisma.smsThread.count({
      where: {
        bookedViaSms: true,
        createdAt: { gte: month },
      },
    }),
  ]);

  const leadsByStatusMap: Record<string, number> = {};
  for (const g of leadsByStatus) {
    leadsByStatusMap[g.status] = g._count.id;
  }

  const funnelSnapshot = [
    { stage: 'Leads', count: await prisma.lead.count({ where: { createdAt: { gte: month } } }) },
    {
      stage: 'Contacted',
      count: await prisma.lead.count({
        where: {
          status: { in: ['CONTACTED', 'INTERESTED', 'QUALIFYING', 'QUALIFIED', 'APPOINTMENT_SET', 'NOT_INTERESTED', 'DEPOSITION'] },
          createdAt: { gte: month },
        },
      }),
    },
    {
      stage: 'Qualified',
      count: await prisma.lead.count({
        where: {
          status: { in: ['QUALIFIED', 'APPOINTMENT_SET'] },
          createdAt: { gte: month },
        },
      }),
    },
    {
      stage: 'Appointments',
      count: await prisma.appointment.count({
        where: { createdAt: { gte: month } },
      }),
    },
    {
      stage: 'Proposals',
      count: await prisma.opportunity.count({
        where: { createdAt: { gte: month } },
      }),
    },
    {
      stage: 'Won',
      count: await prisma.opportunity.count({
        where: {
          stage: OpportunityStage.WON,
          createdAt: { gte: month },
        },
      }),
    },
  ];

  const noShowRate = completedCount + noShowCount > 0 ? noShowCount / (completedCount + noShowCount) : 0;

  const alerts: Array<{
    type: string;
    title: string;
    count: number;
    severity: 'high' | 'medium' | 'low';
    entityIds: string[];
    actions: { label: string; action: string }[];
  }> = [];

  if (leadsNotContacted5Min > 0) {
    const hot = await prisma.lead.findMany({
      where: {
        status: LeadStatus.NEW,
        createdAt: { lte: fiveMinAgo },
      },
      select: { id: true },
      take: 10,
    });
    alerts.push({
      type: 'hot_leads',
      title: 'Leads Not Contacted (5min SLA)',
      count: leadsNotContacted5Min,
      severity: 'high',
      entityIds: hot.map((l) => l.id),
      actions: [{ label: 'View', action: 'view' }, { label: 'Assign', action: 'assign' }],
    });
  }

  const qualifiedNoAppt = await prisma.lead.count({
    where: {
      status: LeadStatus.QUALIFIED,
      appointments: { none: {} },
    },
  });
  if (qualifiedNoAppt > 0) {
    const leads = await prisma.lead.findMany({
      where: {
        status: LeadStatus.QUALIFIED,
        appointments: { none: {} },
      },
      select: { id: true },
      take: 5,
    });
    alerts.push({
      type: 'qualified_no_appt',
      title: 'Qualified, No Appointment',
      count: qualifiedNoAppt,
      severity: 'high',
      entityIds: leads.map((l) => l.id),
      actions: [{ label: 'Set Appointment', action: 'set_appt' }],
    });
  }

  const overdueTasks = await prisma.task.count({
    where: { status: 'OVERDUE' },
  });
  if (overdueTasks > 0) {
    const tasks = await prisma.task.findMany({
      where: { status: 'OVERDUE' },
      select: { id: true },
      take: 5,
    });
    alerts.push({
      type: 'overdue',
      title: 'Overdue Follow-ups',
      count: overdueTasks,
      severity: 'medium',
      entityIds: tasks.map((t) => t.id),
      actions: [{ label: 'View Tasks', action: 'view_tasks' }],
    });
  }

  const failedSms = await prisma.smsMessage.count({
    where: { direction: 'OUTBOUND', deliveryStatus: 'FAILED' },
  });
  if (failedSms > 0) {
    const msgs = await prisma.smsMessage.findMany({
      where: { direction: 'OUTBOUND', deliveryStatus: 'FAILED' },
      select: { id: true },
      take: 5,
    });
    alerts.push({
      type: 'failed_sms',
      title: 'Failed SMS Deliveries',
      count: failedSms,
      severity: 'high',
      entityIds: msgs.map((m) => m.id),
      actions: [{ label: 'Inspect', action: 'inspect' }],
    });
  }

  // Appointments require fieldSalesRepId in schema - no "missing rep" case

  const priorWon = Number(wonRevenuePriorMonth._sum.estimatedValue ?? 0);
  const thisWon = Number(wonRevenueThisMonth._sum.estimatedValue ?? 0);

  return {
    metrics: {
      newLeadsToday,
      newLeadsYesterday,
      leadsNotContacted5Min,
      leadsNotContacted15Min,
      leadsByStatus: leadsByStatusMap,
      appointmentsToday,
      appointmentsThisWeek,
      wonRevenueThisMonth: thisWon,
      wonRevenuePriorMonth: priorWon,
      lostOpportunitiesThisMonth,
      noShowRate,
      pipelineValue: Number(pipelineValue._sum.estimatedValue ?? 0),
      pipelineOpportunityCount,
      bookedViaSms,
      funnelSnapshot,
    },
    alerts,
  };
}

export type AdminChartPeriod = 'week' | 'month' | 'quarter';

function chartPeriodStart(period: AdminChartPeriod): Date {
  if (period === 'week') {
    return weekStart();
  }
  if (period === 'month') {
    return monthStart();
  }
  const now = new Date();
  const m = Math.floor(now.getMonth() / 3) * 3;
  const d = new Date(now.getFullYear(), m, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Funnel + status breakdown for a selectable window (admin charts). */
export async function getAdminOverviewCharts(period: AdminChartPeriod) {
  const from = chartPeriodStart(period);

  const statusGroups = await prisma.lead.groupBy({
    by: ['status'],
    _count: { id: true },
    where: { createdAt: { gte: from } },
  });
  const leadsByStatus: Record<string, number> = {};
  for (const g of statusGroups) {
    leadsByStatus[g.status] = g._count.id;
  }

  const funnelSnapshot = [
    { stage: 'Leads', count: await prisma.lead.count({ where: { createdAt: { gte: from } } }) },
    {
      stage: 'Contacted',
      count: await prisma.lead.count({
        where: {
          status: {
            in: [
              'CONTACTED',
              'INTERESTED',
              'QUALIFYING',
              'QUALIFIED',
              'APPOINTMENT_SET',
              'NOT_INTERESTED',
              'DEPOSITION',
            ],
          },
          createdAt: { gte: from },
        },
      }),
    },
    {
      stage: 'Qualified',
      count: await prisma.lead.count({
        where: {
          status: { in: ['QUALIFIED', 'APPOINTMENT_SET'] },
          createdAt: { gte: from },
        },
      }),
    },
    {
      stage: 'Appointments',
      count: await prisma.appointment.count({
        where: { createdAt: { gte: from } },
      }),
    },
    {
      stage: 'Proposals',
      count: await prisma.opportunity.count({
        where: { createdAt: { gte: from } },
      }),
    },
    {
      stage: 'Won',
      count: await prisma.opportunity.count({
        where: {
          stage: OpportunityStage.WON,
          createdAt: { gte: from },
        },
      }),
    },
  ];

  return {
    period,
    periodStart: from.toISOString(),
    leadsByStatus,
    funnelSnapshot,
  };
}

/** Lead ids where the digit-only phone matches at least one other lead (same number, different rows). */
async function getLeadIdsWithDuplicatePhoneDigits(): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH norm AS (
      SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') AS digits
      FROM "Lead"
      WHERE length(regexp_replace(phone, '[^0-9]', '', 'g')) > 0
    ),
    dup_digits AS (
      SELECT digits FROM norm GROUP BY digits HAVING COUNT(*) > 1
    )
    SELECT n.id FROM norm n
    INNER JOIN dup_digits d ON n.digits = d.digits
  `);
  return rows.map((r) => r.id);
}

export async function getAdminLeads(query: {
  view?: string;
  search?: string;
  status?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}) {
  const { search: searchRaw, status, source, page = 1, pageSize = 50 } = query;
  const viewRaw = (query.view && String(query.view).trim()) || 'all';
  const view = viewRaw === 'stuck' || viewRaw === 'at-risk' ? 'all' : viewRaw;
  const skip = (page - 1) * pageSize;
  const search = (searchRaw ?? '').trim();

  const and: Prisma.LeadWhereInput[] = [];

  if (search) {
    const s = search.toLowerCase();
    and.push({
      OR: [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: s, mode: 'insensitive' } },
        { postcode: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (source && source !== 'all') {
    and.push({ source: { equals: source, mode: 'insensitive' } });
  }

  if (view === 'unassigned') {
    and.push({ assignedAgentId: null });
  }
  if (view === 'duplicates') {
    const dupIds = await getLeadIdsWithDuplicatePhoneDigits();
    if (dupIds.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }
    and.push({ id: { in: dupIds } });
  }
  if (view === 'no-activity') {
    const stale = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    and.push({ updatedAt: { lte: stale } });
  }

  if (status && status !== 'all') {
    and.push({ status: status as LeadStatus });
  }

  const where: Prisma.LeadWhereInput = and.length > 0 ? { AND: and } : {};

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        assignedAgent: { select: { id: true, fullName: true } },
        assignedQualifier: { select: { id: true, fullName: true } },
        assignedFieldSalesRep: { select: { id: true, fullName: true } },
        duplicateOfLead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return {
    items: leads.map((l) => ({
      id: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      phone: l.phone,
      email: l.email,
      status: l.status,
      source: l.source ?? '',
      assignedAgentId: l.assignedAgentId ?? undefined,
      assignedAgentName: l.assignedAgent?.fullName,
      assignedQualifierId: l.assignedQualifierId ?? undefined,
      assignedQualifierName: l.assignedQualifier?.fullName,
      assignedFieldSalesRepId: l.assignedFieldSalesRepId ?? undefined,
      assignedFieldSalesRepName: l.assignedFieldSalesRep?.fullName,
      createdAt: l.createdAt.toISOString(),
      lastActivityAt: l.updatedAt.toISOString(),
      postcode: l.postcode ?? undefined,
      smsAutomationPaused: l.smsAutomationPaused,
      priority: l.priority,
      duplicateOfLeadId: l.duplicateOfLeadId ?? undefined,
      duplicateOfLeadName: l.duplicateOfLead
        ? `${l.duplicateOfLead.firstName} ${l.duplicateOfLead.lastName}`.trim()
        : undefined,
    })),
    total,
    page,
    pageSize,
  };
}

/**
 * Merge `mergeLeadId` into `keepLeadId` (canonical). Deletes the merged lead after moving related rows.
 */
export async function mergeLeads(keepLeadId: string, mergeLeadId: string): Promise<{ mergedIntoId: string; removedId: string }> {
  if (keepLeadId === mergeLeadId) {
    throw new AppError('Cannot merge a lead with itself', 400);
  }
  const [keep, remove] = await Promise.all([
    prisma.lead.findUnique({ where: { id: keepLeadId } }),
    prisma.lead.findUnique({ where: { id: mergeLeadId } }),
  ]);
  if (!keep || !remove) {
    throw new AppError('Lead not found', 404);
  }

  await prisma.$transaction(async (tx) => {
    const removeThreads = await tx.smsThread.findMany({ where: { leadId: mergeLeadId } });
    for (const rt of removeThreads) {
      const existing = await tx.smsThread.findFirst({
        where: { leadId: keepLeadId, phone: rt.phone },
      });
      if (existing) {
        await tx.smsMessage.updateMany({ where: { threadId: rt.id }, data: { threadId: existing.id } });
        await tx.smsThread.delete({ where: { id: rt.id } });
      } else {
        await tx.smsThread.update({ where: { id: rt.id }, data: { leadId: keepLeadId } });
      }
    }

    await tx.appointment.updateMany({ where: { leadId: mergeLeadId }, data: { leadId: keepLeadId } });
    await tx.opportunity.updateMany({ where: { leadId: mergeLeadId }, data: { leadId: keepLeadId } });
    await tx.task.updateMany({ where: { leadId: mergeLeadId }, data: { leadId: keepLeadId } });
    await tx.note.updateMany({ where: { leadId: mergeLeadId }, data: { leadId: keepLeadId } });
    await tx.activityEvent.updateMany({ where: { leadId: mergeLeadId }, data: { leadId: keepLeadId } });
    await tx.callLog.updateMany({ where: { leadId: mergeLeadId }, data: { leadId: keepLeadId } });
    await tx.leadStatusHistory.updateMany({ where: { leadId: mergeLeadId }, data: { leadId: keepLeadId } });

    await tx.lead.updateMany({
      where: { duplicateOfLeadId: mergeLeadId },
      data: { duplicateOfLeadId: keepLeadId },
    });

    await tx.lead.delete({ where: { id: mergeLeadId } });
  });

  return { mergedIntoId: keepLeadId, removedId: mergeLeadId };
}

export async function deleteLead(id: string): Promise<void> {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Lead not found', 404);
  }
  await prisma.$transaction(async (tx) => {
    await tx.lead.updateMany({ where: { duplicateOfLeadId: id }, data: { duplicateOfLeadId: null } });
    await tx.lead.delete({ where: { id } });
  });
}

export async function getAdminAppointments(query: {
  status?: string;
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
}) {
  const { status, page = 1, pageSize = 50 } = query;
  const skip = (page - 1) * pageSize;

  const where: Prisma.AppointmentWhereInput = {};
  if (status && status !== 'all') where.status = status as AppointmentStatus;
  if (query.from && query.to) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      where.scheduledAt = { gte: from, lte: to };
    }
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, addressLine1: true, city: true, postcode: true } },
        fieldSalesRep: { select: { id: true, fullName: true } },
      },
      orderBy: { scheduledAt: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);

  return {
    items: appointments.map((a) => ({
      id: a.id,
      leadId: a.leadId,
      leadName: `${a.lead.firstName} ${a.lead.lastName}`,
      scheduledAt: a.scheduledAt.toISOString(),
      status: a.status,
      fieldSalesRepId: a.fieldSalesRepId,
      fieldSalesRepName: a.fieldSalesRep?.fullName,
      address: [a.lead.addressLine1, a.lead.city, a.lead.postcode].filter(Boolean).join(', ') || undefined,
      notes: a.notes ?? undefined,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getAdminOpportunities(query: { stage?: string; page?: number; pageSize?: number }) {
  const { stage, page = 1, pageSize = 50 } = query;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (stage && stage !== 'all') where.stage = stage;

  const [opps, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true } },
        owner: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return {
    items: opps.map((o) => ({
      id: o.id,
      leadId: o.leadId,
      leadName: `${o.lead.firstName} ${o.lead.lastName}`,
      stage: o.stage,
      estimatedValue: Number(o.estimatedValue),
      productType: o.productType,
      fieldSalesRepName: o.owner?.fullName,
      createdAt: o.createdAt.toISOString(),
      daysInStage: Math.floor((Date.now() - o.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
    })),
    total,
    page,
    pageSize,
  };
}

export async function getAdminUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      createdAt: true,
    },
    orderBy: { fullName: 'asc' },
  });

  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    status: 'active' as const,
    createdAt: u.createdAt.toISOString(),
      lastLoginAt: undefined,
  }));
}

export async function getSmsMetrics() {
  const today = todayStart();
  const week = weekStart();
  const month = monthStart();

  const sentToday = await prisma.smsMessage.count({
    where: { direction: 'OUTBOUND', createdAt: { gte: today } },
  });
  const sentThisWeek = await prisma.smsMessage.count({
    where: { direction: 'OUTBOUND', createdAt: { gte: week } },
  });
  const sentThisMonth = await prisma.smsMessage.count({
    where: { direction: 'OUTBOUND', createdAt: { gte: month } },
  });
  const inboundCount = await prisma.smsMessage.count({
    where: { direction: 'INBOUND', createdAt: { gte: month } },
  });
  const optOutCount = await prisma.smsThread.count({
    where: { status: 'ARCHIVED', updatedAt: { gte: month } },
  });
  const totalThreads = await prisma.smsThread.count({ where: { createdAt: { gte: month } } });
  const bookedViaSms = await prisma.smsThread.count({
    where: { bookedViaSms: true, createdAt: { gte: month } },
  });
  const failedDelivery = await prisma.smsMessage.count({
    where: { direction: 'OUTBOUND', deliveryStatus: 'FAILED' },
  });
  const activeConversations = await prisma.smsThread.count({
    where: {
      status: 'ACTIVE',
      lastMessageAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  const replyRate = sentThisMonth > 0 ? inboundCount / sentThisMonth : 0;
  const optOutRate = totalThreads > 0 ? optOutCount / totalThreads : 0;

  return {
    sentToday,
    sentThisWeek,
    sentThisMonth,
    replyRate,
    optOutRate,
    bookedViaSms,
    failedDelivery,
    activeConversations,
    waitingForReply: 0,
    requiringTakeover: 0,
  };
}

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;

export async function getDataQualityIssues() {
  const phoneGroups = await prisma.lead.groupBy({
    by: ['phone'],
    where: { phone: { not: '' } },
    _count: { id: true },
  });
  const dupPhones = phoneGroups.filter((g) => g._count.id > 1);
  const dupPhoneGroups: { key: string; ids: string[] }[] = [];
  const dupPhoneIds: string[] = [];
  for (const g of dupPhones.slice(0, 20)) {
    const rows = await prisma.lead.findMany({
      where: { phone: g.phone },
      select: { id: true },
      take: 30,
    });
    dupPhoneGroups.push({ key: g.phone, ids: rows.map((r) => r.id) });
    dupPhoneIds.push(...rows.map((r) => r.id));
  }
  const duplicatePhoneCount = dupPhones.reduce((s, g) => s + (g._count.id - 1), 0);

  const emailGroups = await prisma.lead.groupBy({
    by: ['email'],
    where: { email: { not: '' } },
    _count: { id: true },
  });
  const dupEmails = emailGroups.filter((g) => g._count.id > 1);
  const dupEmailGroups: { key: string; ids: string[] }[] = [];
  const dupEmailIds: string[] = [];
  for (const g of dupEmails.slice(0, 20)) {
    const rows = await prisma.lead.findMany({
      where: { email: g.email },
      select: { id: true },
      take: 30,
    });
    dupEmailGroups.push({ key: g.email, ids: rows.map((r) => r.id) });
    dupEmailIds.push(...rows.map((r) => r.id));
  }
  const duplicateEmailCount = dupEmails.reduce((s, g) => s + (g._count.id - 1), 0);

  const missingPhone = await prisma.lead.count({ where: { phone: '' } });

  const leadsWithPostcode = await prisma.lead.findMany({
    where: { postcode: { not: null } },
    select: { id: true, postcode: true },
    take: 10000,
  });
  const invalidPostcodeIds = leadsWithPostcode
    .filter((l) => {
      const p = (l.postcode ?? '').trim();
      if (!p) return false;
      return !UK_POSTCODE_REGEX.test(p);
    })
    .map((l) => l.id);

  const opportunitiesMissingValue = await prisma.opportunity.count({
    where: { estimatedValue: { lte: 0 } },
  });
  const oppIdsMissing = await prisma.opportunity.findMany({
    where: { estimatedValue: { lte: 0 } },
    select: { id: true },
    take: 50,
  });

  const leadsMissingSourceCount = await prisma.lead.count({
    where: { OR: [{ source: null }, { source: '' }] },
  });
  const leadsMissingSource = await prisma.lead.findMany({
    where: { OR: [{ source: null }, { source: '' }] },
    select: { id: true },
    take: 200,
  });

  return {
    issues: [
      {
        type: 'duplicate_leads',
        title: 'Duplicate Leads (same phone)',
        count: duplicatePhoneCount,
        ids: [...new Set(dupPhoneIds)].slice(0, 100),
        groups: dupPhoneGroups.length > 0 ? dupPhoneGroups : undefined,
      },
      {
        type: 'duplicate_email',
        title: 'Duplicate Leads (same email)',
        count: duplicateEmailCount,
        ids: [...new Set(dupEmailIds)].slice(0, 100),
        groups: dupEmailGroups.length > 0 ? dupEmailGroups : undefined,
      },
      {
        type: 'missing_phone',
        title: 'Missing Phone Numbers',
        count: missingPhone,
        ids: (
          await prisma.lead.findMany({
            where: { phone: '' },
            select: { id: true },
            take: 100,
          })
        ).map((l) => l.id),
      },
      {
        type: 'invalid_postcode',
        title: 'Postcode format check (UK)',
        count: invalidPostcodeIds.length,
        ids: invalidPostcodeIds.slice(0, 100),
      },
      {
        type: 'opportunities_missing_value',
        title: 'Opportunities With Zero or Negative Value',
        count: opportunitiesMissingValue,
        ids: oppIdsMissing.map((o) => o.id),
      },
      {
        type: 'leads_missing_source',
        title: 'Leads Missing Source',
        count: leadsMissingSourceCount,
        ids: leadsMissingSource.map((l) => l.id),
      },
    ],
  };
}

export async function getAdminAuditLog(query: {
  page?: number;
  pageSize?: number;
  userId?: string;
}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: { changedByUserId?: string } = {};
  if (query.userId) where.changedByUserId = query.userId;

  const [rows, total] = await Promise.all([
    prisma.leadStatusHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        changedByUser: { select: { fullName: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.leadStatusHistory.count({ where }),
  ]);

  const items = rows.map((h) => ({
    id: h.id,
    userId: h.changedByUserId,
    userName: h.changedByUser.fullName,
    action: 'STATUS_CHANGE',
    entityType: 'LEAD',
    entityId: h.leadId,
    oldValue: h.fromStatus ? { status: h.fromStatus } : undefined,
    newValue: { status: h.toStatus },
    metadata: { leadName: `${h.lead.firstName} ${h.lead.lastName}` },
    createdAt: h.createdAt.toISOString(),
  }));

  return { items, total, page, pageSize };
}

export function getAdminSettingsConfig() {
  return {
    sections: [
      {
        key: 'lead_statuses',
        label: 'Lead Statuses',
        description: 'Lifecycle statuses (defined in application schema).',
        items: [{ key: 'statuses', label: 'Statuses', value: Object.values(LeadStatus).join(', ') }],
      },
      {
        key: 'appointment_statuses',
        label: 'Appointment Statuses',
        description: 'Appointment outcome states.',
        items: [{ key: 'statuses', label: 'Statuses', value: Object.values(AppointmentStatus).join(', ') }],
      },
      {
        key: 'opportunity_stages',
        label: 'Opportunity Stages',
        description: 'Sales pipeline stages.',
        items: [{ key: 'stages', label: 'Stages', value: Object.values(OpportunityStage).join(', ') }],
      },
      {
        key: 'roles',
        label: 'User Roles',
        description: 'Assignable roles.',
        items: [{ key: 'roles', label: 'Roles', value: Object.values(Role).join(', ') }],
      },
      {
        key: 'product_types',
        label: 'Product Types',
        description: 'Opportunity product types.',
        items: [{ key: 'types', label: 'Types', value: Object.values(ProductType).join(', ') }],
      },
      {
        key: 'task_types',
        label: 'Task Types',
        description: 'Task categories.',
        items: [{ key: 'types', label: 'Types', value: Object.values(TaskType).join(', ') }],
      },
      {
        key: 'task_priorities',
        label: 'Task Priorities',
        description: 'Task priority levels.',
        items: [{ key: 'priorities', label: 'Priorities', value: Object.values(TaskPriority).join(', ') }],
      },
    ],
  };
}

export async function getTeamWorkload(period: 'week' | 'month' | 'quarter') {
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
  const from = new Date(Date.now() - days * 86400000);

  const [agentCount, repCount, leadsWithAgent, apptCount, histories] = await Promise.all([
    prisma.user.count({ where: { role: Role.AGENT } }),
    prisma.user.count({ where: { role: Role.FIELD_SALES } }),
    prisma.lead.count({
      where: { assignedAgentId: { not: null }, createdAt: { gte: from } },
    }),
    prisma.appointment.count({ where: { createdAt: { gte: from } } }),
    prisma.leadStatusHistory.findMany({
      where: { fromStatus: LeadStatus.NEW, createdAt: { gte: from } },
      include: { lead: { select: { createdAt: true } } },
      take: 4000,
    }),
  ]);

  const avgLeadsPerAgent = agentCount > 0 ? Math.round((leadsWithAgent / agentCount) * 10) / 10 : 0;
  const avgAppointmentsPerRep =
    repCount > 0 ? Math.round((apptCount / repCount) * 10) / 10 : 0;

  const deltas = histories
    .map((h) => (h.createdAt.getTime() - h.lead.createdAt.getTime()) / 60000)
    .filter((m) => m >= 0 && m < 7 * 24 * 60);
  const avgFirstResponseMinutes =
    deltas.length > 0
      ? Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10
      : null;

  return {
    period,
    avgLeadsPerAgent,
    avgAppointmentsPerRep,
    avgFirstResponseMinutes,
  };
}
