import { prisma } from '../../db';
import { LeadStatus, OpportunityStage, ProductType, AppointmentStatus, AppointmentOutcome } from '@prisma/client';

type ReportScope = {
  userId: string;
  role: 'ADMIN' | 'AGENT' | 'QUALIFIER' | 'FIELD_SALES';
};

function getDateRange(monthsBack: number) {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - monthsBack);
  return { from, to };
}

async function getAgentSubmittedLeadIds(agentId: string, from: Date, to: Date): Promise<string[]> {
  const rows = await prisma.leadStatusHistory.findMany({
    where: {
      changedByUserId: agentId,
      toStatus: LeadStatus.QUALIFYING,
      createdAt: { gte: from, lte: to },
    },
    select: { leadId: true },
    distinct: ['leadId'],
  });
  return rows.map((r) => r.leadId);
}

async function scopedLeadWhere(scope: ReportScope, from: Date, to?: Date) {
  const createdAt = to ? { gte: from, lte: to } : { gte: from };
  if (scope.role === 'ADMIN') return { createdAt };
  if (scope.role === 'QUALIFIER') {
    return {
      createdAt,
      OR: [{ assignedQualifierId: scope.userId }, { qualifiedByQualifierId: scope.userId }],
    };
  }
  if (scope.role === 'FIELD_SALES') return { createdAt, assignedFieldSalesRepId: scope.userId };
  const submittedIds = await getAgentSubmittedLeadIds(scope.userId, from, to ?? new Date());
  return { createdAt, id: { in: submittedIds.length ? submittedIds : ['__none__'] } };
}

export async function getFunnelReport(monthsBack: number, scope: ReportScope) {
  const { from } = getDateRange(monthsBack);
  const where = await scopedLeadWhere(scope, from);

  const leads = await prisma.lead.findMany({
    where,
    select: { id: true, status: true },
  });
  const leadIds = leads.map((l) => l.id);
  const noLeads = leadIds.length === 0;

  const stages = [
    { name: 'Leads Created', value: leads.length, key: 'total' },
    {
      name: 'Contacted',
      value: leads.filter((l) =>
        ['CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'DEPOSITION', 'QUALIFYING', 'QUALIFIED', 'SOLD', 'NOT_QUALIFIED', 'APPOINTMENT_SET'].includes(l.status)
      ).length,
      key: 'contacted',
    },
    {
      name: 'Interested',
      value: leads.filter((l) =>
        ['INTERESTED', 'QUALIFYING', 'QUALIFIED', 'SOLD', 'APPOINTMENT_SET'].includes(l.status)
      ).length,
      key: 'interested',
    },
    {
      name: 'Qualified',
      value: leads.filter((l) =>
        ['QUALIFIED', 'SOLD', 'APPOINTMENT_SET'].includes(l.status)
      ).length,
      key: 'qualified',
    },
    {
      name: 'Appointments Set',
      value: leads.filter((l) => l.status === 'APPOINTMENT_SET').length,
      key: 'appointments',
    },
    {
      name: 'Proposals/Opportunities',
      value: await prisma.opportunity.count({
        where: {
          createdAt: { gte: from },
          leadId: noLeads ? { in: ['__none__'] } : { in: leadIds },
        },
      }),
      key: 'proposals',
    },
    {
      name: 'Sales Closed',
      value: await prisma.opportunity.count({
        where: {
          stage: OpportunityStage.WON,
          createdAt: { gte: from },
          leadId: noLeads ? { in: ['__none__'] } : { in: leadIds },
        },
      }),
      key: 'won',
    },
  ];

  return stages;
}

export async function getProductMixReport(monthsBack: number, scope: ReportScope) {
  const { from } = getDateRange(monthsBack);
  const where =
    scope.role === 'ADMIN'
      ? { createdAt: { gte: from } }
      : scope.role === 'FIELD_SALES'
        ? { createdAt: { gte: from }, ownerId: scope.userId }
        : scope.role === 'QUALIFIER'
          ? {
              createdAt: { gte: from },
              lead: {
                OR: [
                  { assignedQualifierId: scope.userId },
                  { qualifiedByQualifierId: scope.userId },
                ],
              },
            }
          : { createdAt: { gte: from } };

  const opportunities = await prisma.opportunity.findMany({
    where: {
      ...where,
      stage: OpportunityStage.WON,
    },
    select: { productType: true, estimatedValue: true },
  });

  const byProduct: Record<string, { count: number; revenue: number }> = {
    SOLAR: { count: 0, revenue: 0 },
    BATTERY: { count: 0, revenue: 0 },
    EV_CHARGER: { count: 0, revenue: 0 },
    BUNDLE: { count: 0, revenue: 0 },
  };

  for (const opp of opportunities) {
    const key = opp.productType;
    if (byProduct[key]) {
      byProduct[key].count += 1;
      byProduct[key].revenue += Number(opp.estimatedValue);
    }
  }

  const productNames: Record<ProductType, string> = {
    SOLAR: 'Solar Only',
    BATTERY: 'Solar + Battery',
    EV_CHARGER: 'EV Charger',
    BUNDLE: 'Full Bundle',
  };

  const colors: Record<string, string> = {
    SOLAR: '#66cc66',
    BATTERY: '#33cc66',
    EV_CHARGER: '#00cc99',
    BUNDLE: '#3333cc',
  };

  return Object.entries(byProduct).map(([key, data]) => ({
    name: productNames[key as ProductType],
    value: data.count,
    revenue: data.revenue,
    color: colors[key] || '#666666',
  }));
}

export async function getMonthlyTrendsReport(monthsBack: number, scope: ReportScope) {
  const { from } = getDateRange(monthsBack);
  const leadWhere = await scopedLeadWhere(scope, from);
  const appointmentWhere =
    scope.role === 'ADMIN'
      ? { createdAt: { gte: from } }
      : scope.role === 'FIELD_SALES'
        ? { createdAt: { gte: from }, fieldSalesRepId: scope.userId }
        : scope.role === 'QUALIFIER'
          ? {
              createdAt: { gte: from },
              lead: {
                OR: [
                  { assignedQualifierId: scope.userId },
                  { qualifiedByQualifierId: scope.userId },
                ],
              },
            }
          : { createdAt: { gte: from } };
  const opportunityWhere =
    scope.role === 'ADMIN'
      ? { createdAt: { gte: from } }
      : scope.role === 'FIELD_SALES'
        ? { createdAt: { gte: from }, ownerId: scope.userId }
        : scope.role === 'QUALIFIER'
          ? {
              createdAt: { gte: from },
              lead: {
                OR: [
                  { assignedQualifierId: scope.userId },
                  { qualifiedByQualifierId: scope.userId },
                ],
              },
            }
          : { createdAt: { gte: from } };

  const leads = await prisma.lead.findMany({
    where: leadWhere,
    select: { createdAt: true, status: true },
  });

  const appointments = await prisma.appointment.findMany({
    where: appointmentWhere,
    select: { scheduledAt: true, status: true },
  });

  const opportunities = await prisma.opportunity.findMany({
    where: opportunityWhere,
    select: { createdAt: true, stage: true, estimatedValue: true },
  });

  const months: Record<
    string,
    { leads: number; appointments: number; sales: number; revenue: number }
  > = {};

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  for (let i = 0; i < monthsBack; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - (monthsBack - 1 - i));
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    months[key] = { leads: 0, appointments: 0, sales: 0, revenue: 0 };
  }

  for (const lead of leads) {
    const d = lead.createdAt;
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (months[key]) months[key].leads += 1;
  }

  for (const apt of appointments) {
    const d = apt.scheduledAt;
    const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    if (months[key]) months[key].appointments += 1;
  }

  for (const opp of opportunities) {
    if (opp.stage === OpportunityStage.WON) {
      const d = opp.createdAt;
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (months[key]) {
        months[key].sales += 1;
        months[key].revenue += Number(opp.estimatedValue);
      }
    }
  }

  return Object.entries(months)
    .sort((a, b) => {
      const [monthA, yearA] = a[0].split(' ');
      const [monthB, yearB] = b[0].split(' ');
      if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
      return monthNames.indexOf(monthA) - monthNames.indexOf(monthB);
    })
    .map(([month, data]) => ({ month, ...data }));
}

export async function getRepPerformanceReport(monthsBack: number, scope: ReportScope) {
  const { from } = getDateRange(monthsBack);

  if (scope.role === 'QUALIFIER') {
    const user = await prisma.user.findUnique({
      where: { id: scope.userId },
      select: { id: true, fullName: true, role: true },
    });
    if (!user || user.role !== 'QUALIFIER') {
      return [];
    }
    const leadWhere = await scopedLeadWhere(scope, from);
    const leadRows = await prisma.lead.findMany({
      where: leadWhere,
      select: { id: true },
    });
    const leadIds = leadRows.map((l) => l.id);
    const empty = leadIds.length === 0;

    const [appointmentCount, wonOpps] = await Promise.all([
      prisma.appointment.count({
        where: {
          createdAt: { gte: from },
          leadId: empty ? { in: ['__none__'] } : { in: leadIds },
        },
      }),
      prisma.opportunity.findMany({
        where: {
          createdAt: { gte: from },
          stage: OpportunityStage.WON,
          leadId: empty ? { in: ['__none__'] } : { in: leadIds },
        },
        select: { estimatedValue: true },
      }),
    ]);

    const leads = leadIds.length;
    const appointments = appointmentCount;
    const sales = wonOpps.length;
    const revenue = wonOpps.reduce((sum, o) => sum + Number(o.estimatedValue), 0);
    const calls = leads + appointments;
    const conversionRate = calls > 0 ? ((sales / calls) * 100).toFixed(1) : '0';

    return [
      {
        id: user.id,
        name: user.fullName,
        role: user.role,
        calls,
        leads,
        appointments,
        sales,
        revenue,
        conversionRate: parseFloat(conversionRate),
      },
    ];
  }

  const users = await prisma.user.findMany({
    where: {
      role: { in: ['AGENT', 'FIELD_SALES', 'QUALIFIER'] },
    },
    select: {
      id: true,
      fullName: true,
      role: true,
      leadsAsAgent: {
        where: { createdAt: { gte: from } },
        select: { id: true },
      },
      leadsAsQualifier: {
        where: { createdAt: { gte: from } },
        select: { id: true },
      },
      leadsQualifiedBy: {
        where: { createdAt: { gte: from } },
        select: { id: true },
      },
      appointments: {
        where: { createdAt: { gte: from } },
        select: { id: true, status: true },
      },
      opportunities: {
        where: { createdAt: { gte: from } },
        select: { stage: true, estimatedValue: true },
      },
    },
  });

  return users.map((user) => {
    const leads =
      user.role === 'QUALIFIER'
        ? new Set([
            ...user.leadsAsQualifier.map((l) => l.id),
            ...user.leadsQualifiedBy.map((l) => l.id),
          ]).size
        : user.leadsAsAgent.length;
    const appointments = user.appointments.length;
    const wonOpps = user.opportunities.filter((o) => o.stage === OpportunityStage.WON);
    const sales = wonOpps.length;
    const revenue = wonOpps.reduce((sum, o) => sum + Number(o.estimatedValue), 0);
    const calls = leads + appointments;
    const conversionRate = calls > 0 ? ((sales / calls) * 100).toFixed(1) : '0';

    return {
      id: user.id,
      name: user.fullName,
      role: user.role,
      calls,
      leads,
      appointments,
      sales,
      revenue,
      conversionRate: parseFloat(conversionRate),
    };
  });
}

/** Weekly Lead Performance (Looker-style): Not Interested, Call Back, Wrong Number, Appointment Booked, DNQ */
export async function getWeeklyLeadPerformanceReport(weeksBack = 1, scope: ReportScope) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7 * weeksBack);
  const where = await scopedLeadWhere(scope, from, to);

  const leads = await prisma.lead.findMany({
    where,
    select: { id: true, status: true },
  });

  const wrongNumberLeads = await prisma.callLog.findMany({
    where: { outcome: 'WRONG_NUMBER', createdAt: { gte: from, lte: to } },
    select: { leadId: true },
    distinct: ['leadId'],
  });

  const notInterested = leads.filter(
    (l) => l.status === LeadStatus.NOT_INTERESTED || l.status === LeadStatus.DEPOSITION
  ).length;
  const callBack = leads.filter((l) => l.status === LeadStatus.QUALIFIER_CALLBACK).length;
  const wrongNumber = wrongNumberLeads.length;
  const appointmentBooked = leads.filter((l) => l.status === LeadStatus.APPOINTMENT_SET).length;
  const dnq = leads.filter((l) => l.status === LeadStatus.NOT_QUALIFIED).length;

  return [
    { name: 'Not Interested', value: notInterested, fill: '#22c55e' },
    { name: 'Call Back', value: callBack, fill: '#22c55e' },
    { name: 'Wrong Number', value: wrongNumber, fill: '#22c55e' },
    { name: 'Appointment Booked', value: appointmentBooked, fill: '#22c55e' },
    { name: 'DNQ', value: dnq, fill: '#22c55e' },
  ];
}

/** Leads Funnel (Looker-style): Total Leads → Contacted → Callback → Appointments Booked */
export async function getWeeklyFunnelReport(weeksBack = 1, scope: ReportScope) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7 * weeksBack);
  const where = await scopedLeadWhere(scope, from, to);

  const leads = await prisma.lead.findMany({
    where,
    select: { status: true },
  });

  const total = leads.length;
  const contacted = leads.filter((l) =>
    ['CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'QUALIFYING', 'QUALIFIED', 'SOLD', 'NOT_QUALIFIED', 'APPOINTMENT_SET', 'QUALIFIER_CALLBACK', 'NO_CONTACT'].includes(l.status)
  ).length;
  const callback = leads.filter((l) => l.status === LeadStatus.QUALIFIER_CALLBACK).length;
  const appointmentsBooked = leads.filter((l) => l.status === LeadStatus.APPOINTMENT_SET).length;

  return [
    { name: 'Total Leads', value: total, fill: '#166534' },
    { name: 'Contacted', value: contacted, fill: '#15803d' },
    { name: 'Callback', value: callback, fill: '#22c55e' },
    { name: 'Appointments Booked', value: appointmentsBooked, fill: '#4ade80' },
  ];
}

/** Agent-specific: Deposition breakdown by reason (leads assigned to agent) */
export async function getAgentDepositionsReport(agentId: string, weeksBack = 4) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7 * weeksBack);

  const leads = await prisma.lead.findMany({
    where: {
      assignedAgentId: agentId,
      status: { in: [LeadStatus.DEPOSITION, LeadStatus.NOT_INTERESTED] },
      updatedAt: { gte: from, lte: to },
    },
    select: { depositionReason: true },
  });

  const byReason: Record<string, number> = {};
  let noReason = 0;
  const reasonLabels: Record<string, string> = {
    tenant: 'Tenant (Not Home Owner)',
    budget: 'Budget Concerns',
    timing: 'Not the Right Time',
    satisfied: 'Satisfied with Current Setup',
    other: 'Other',
  };

  for (const lead of leads) {
    const r = (lead.depositionReason || '').trim().toLowerCase();
    if (!r) {
      noReason += 1;
    } else {
      const key = r in reasonLabels ? r : 'other';
      byReason[key] = (byReason[key] || 0) + 1;
    }
  }

  const result: Array<{ name: string; value: number; fill: string }> = [];
  const palette = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#64748b'];
  let i = 0;
  for (const [key, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    result.push({ name: reasonLabels[key] || key, value: count, fill: palette[i % palette.length] });
    i++;
  }
  if (noReason > 0) {
    result.push({ name: 'No reason recorded', value: noReason, fill: '#94a3b8' });
  }
  return result.length > 0 ? result : [{ name: 'No depositions', value: 0, fill: '#e2e8f0' }];
}

/** Agent-specific: Lead outcomes by status (leads assigned to agent) */
export async function getAgentOutcomesReport(agentId: string, weeksBack = 4) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7 * weeksBack);
  const submittedIds = await getAgentSubmittedLeadIds(agentId, from, to);

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: submittedIds.length ? submittedIds : ['__none__'] },
      createdAt: { gte: from, lte: to },
    },
    select: { status: true },
  });

  const statusLabels: Record<string, string> = {
    NEW: 'New',
    CONTACTED: 'Contacted',
    INTERESTED: 'Interested',
    NOT_INTERESTED: 'Not Interested',
    DEPOSITION: 'Deposition',
    QUALIFYING: 'Sent to Qualifier',
    QUALIFIED: 'Qualified',
    SOLD: 'Sold',
    NOT_QUALIFIED: 'DNQ',
    APPOINTMENT_SET: 'Appointment Set',
    NO_CONTACT: 'No Contact',
    QUALIFIER_CALLBACK: 'Callback',
  };

  const byStatus: Record<string, number> = {};
  for (const lead of leads) {
    byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
  }

  const order = ['NEW', 'CONTACTED', 'INTERESTED', 'QUALIFYING', 'QUALIFIED', 'SOLD', 'APPOINTMENT_SET', 'QUALIFIER_CALLBACK', 'NO_CONTACT', 'NOT_INTERESTED', 'DEPOSITION', 'NOT_QUALIFIED'];
  const result: Array<{ name: string; value: number; fill: string }> = [];
  const palette = ['#3b82f6', '#f59e0b', '#22c55e', '#8b5cf6', '#06b6d4', '#10b981', '#ec4899', '#64748b', '#ef4444', '#f97316', '#94a3b8'];
  let i = 0;
  for (const status of order) {
    const count = byStatus[status] || 0;
    if (count > 0) {
      result.push({ name: statusLabels[status] || status, value: count, fill: palette[i % palette.length] });
      i++;
    }
  }
  for (const [status, count] of Object.entries(byStatus)) {
    if (!order.includes(status)) {
      result.push({ name: statusLabels[status] || status, value: count, fill: palette[i % palette.length] });
      i++;
    }
  }
  return result.length > 0 ? result : [{ name: 'No leads', value: 0, fill: '#e2e8f0' }];
}

/** Agent-specific: Summary stats (leads submitted by agent to qualifier) */
export async function getAgentSummaryReport(agentId: string, weeksBack = 4) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7 * weeksBack);
  const submittedIds = await getAgentSubmittedLeadIds(agentId, from, to);

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: submittedIds.length ? submittedIds : ['__none__'] },
      createdAt: { gte: from, lte: to },
    },
    select: { status: true, productLine: true },
  });

  const total = leads.length;
  const sentToQualifier = leads.filter((l) => l.status === LeadStatus.QUALIFYING).length;
  const depositions = leads.filter(
    (l) => l.status === LeadStatus.DEPOSITION || l.status === LeadStatus.NOT_INTERESTED
  ).length;
  const appointmentSet = leads.filter((l) => l.status === LeadStatus.APPOINTMENT_SET).length;
  const inPipeline = leads.filter((l) => ['NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIER_CALLBACK', 'NO_CONTACT'].includes(l.status)).length;

  const byProductLine = {
    solar: leads.filter((l) => l.productLine === 'SOLAR').length,
    heating: leads.filter((l) => l.productLine === 'HEATING').length,
    unspecified: leads.filter((l) => l.productLine == null).length,
  };

  return {
    totalLeads: total,
    sentToQualifier,
    depositions,
    appointmentSet,
    inPipeline,
    conversionRate: total > 0 ? Math.round((sentToQualifier / total) * 100) : 0,
    byProductLine,
  };
}

/** Solar vs Heating (boilers) — same scope rules as funnel / weekly lead reports */
export async function getLeadProductLineReport(
  scope: ReportScope,
  opts: { weeks?: number; months?: number }
) {
  const to = new Date();
  const from = new Date();
  if (opts.weeks != null) {
    from.setDate(from.getDate() - 7 * opts.weeks);
  } else {
    const m = opts.months ?? 6;
    from.setMonth(from.getMonth() - m);
  }
  const where = await scopedLeadWhere(scope, from, to);
  const leads = await prisma.lead.findMany({
    where,
    select: { productLine: true },
  });

  let solar = 0;
  let heating = 0;
  let unspecified = 0;
  for (const l of leads) {
    if (l.productLine === 'SOLAR') solar += 1;
    else if (l.productLine === 'HEATING') heating += 1;
    else unspecified += 1;
  }

  const out: Array<{ name: string; value: number; fill: string }> = [];
  if (solar) out.push({ name: 'Solar', value: solar, fill: '#f59e0b' });
  if (heating) out.push({ name: 'Heating (boilers)', value: heating, fill: '#0284c7' });
  if (unspecified) out.push({ name: 'Unspecified', value: unspecified, fill: '#94a3b8' });
  return out.length ? out : [{ name: 'No leads in range', value: 0, fill: '#e2e8f0' }];
}

/** Appointment Outcomes (Looker-style): High % to sell, Future Appointment, Appt Not Sat */
export async function getAppointmentOutcomesReport(weeksBack = 4, scope: ReportScope) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7 * weeksBack);
  const where =
    scope.role === 'ADMIN'
      ? { createdAt: { gte: from, lte: to } }
      : scope.role === 'FIELD_SALES'
        ? { createdAt: { gte: from, lte: to }, fieldSalesRepId: scope.userId }
        : scope.role === 'QUALIFIER'
          ? {
              createdAt: { gte: from, lte: to },
              lead: {
                OR: [
                  { assignedQualifierId: scope.userId },
                  { qualifiedByQualifierId: scope.userId },
                ],
              },
            }
          : { createdAt: { gte: from, lte: to } };

  const appointments = await prisma.appointment.findMany({
    where,
    select: { status: true, outcome: true },
  });

  const highToSell = appointments.filter((a) => a.outcome === AppointmentOutcome.SALE_WON).length;
  const futureAppt = appointments.filter((a) => a.status === AppointmentStatus.SCHEDULED).length;
  const apptNotSat = appointments.filter(
    (a) => a.status === AppointmentStatus.NO_SHOW || a.status === AppointmentStatus.CANCELLED || (a.status === AppointmentStatus.COMPLETED && a.outcome !== AppointmentOutcome.SALE_WON)
  ).length;

  return [
    { name: 'High % to sell', value: highToSell, fill: '#166534' },
    { name: 'Future Appointment', value: futureAppt, fill: '#22c55e' },
    { name: 'Appt Not Sat', value: apptNotSat, fill: '#86efac' },
  ];
}
