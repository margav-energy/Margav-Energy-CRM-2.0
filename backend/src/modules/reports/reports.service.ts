import { prisma } from '../../db';
import { LeadStatus, OpportunityStage, ProductType, AppointmentStatus, AppointmentOutcome } from '@prisma/client';

function getDateRange(monthsBack: number) {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - monthsBack);
  return { from, to };
}

export async function getFunnelReport(monthsBack: number) {
  const { from } = getDateRange(monthsBack);

  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: from } },
    select: { status: true },
  });

  const stages = [
    { name: 'Leads Created', value: leads.length, key: 'total' },
    {
      name: 'Contacted',
      value: leads.filter((l) =>
        ['CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'DEPOSITION', 'QUALIFYING', 'QUALIFIED', 'NOT_QUALIFIED', 'APPOINTMENT_SET'].includes(l.status)
      ).length,
      key: 'contacted',
    },
    {
      name: 'Interested',
      value: leads.filter((l) =>
        ['INTERESTED', 'QUALIFYING', 'QUALIFIED', 'APPOINTMENT_SET'].includes(l.status)
      ).length,
      key: 'interested',
    },
    {
      name: 'Qualified',
      value: leads.filter((l) =>
        ['QUALIFIED', 'APPOINTMENT_SET'].includes(l.status)
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
        where: { createdAt: { gte: from } },
      }),
      key: 'proposals',
    },
    {
      name: 'Sales Closed',
      value: await prisma.opportunity.count({
        where: {
          stage: OpportunityStage.WON,
          createdAt: { gte: from },
        },
      }),
      key: 'won',
    },
  ];

  return stages;
}

export async function getProductMixReport(monthsBack: number) {
  const { from } = getDateRange(monthsBack);

  const opportunities = await prisma.opportunity.findMany({
    where: {
      createdAt: { gte: from },
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

export async function getMonthlyTrendsReport(monthsBack: number) {
  const { from } = getDateRange(monthsBack);

  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: from } },
    select: { createdAt: true, status: true },
  });

  const appointments = await prisma.appointment.findMany({
    where: { createdAt: { gte: from } },
    select: { scheduledAt: true, status: true },
  });

  const opportunities = await prisma.opportunity.findMany({
    where: { createdAt: { gte: from } },
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

export async function getRepPerformanceReport(monthsBack: number) {
  const { from } = getDateRange(monthsBack);

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
      user.role === 'QUALIFIER' ? user.leadsAsQualifier.length : user.leadsAsAgent.length;
    const appointments = user.appointments.length;
    const wonOpps = user.opportunities.filter((o) => o.stage === OpportunityStage.WON);
    const sales = wonOpps.length;
    const revenue = wonOpps.reduce((sum, o) => sum + Number(o.estimatedValue), 0);
    const calls = leads + appointments;
    const conversionRate = calls > 0 ? ((sales / calls) * 100).toFixed(1) : '0';

    return {
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
export async function getWeeklyLeadPerformanceReport(weeksBack = 1) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7 * weeksBack);

  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: from, lte: to } },
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
export async function getWeeklyFunnelReport(weeksBack = 1) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7 * weeksBack);

  const leads = await prisma.lead.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { status: true },
  });

  const total = leads.length;
  const contacted = leads.filter((l) =>
    ['CONTACTED', 'INTERESTED', 'NOT_INTERESTED', 'QUALIFYING', 'QUALIFIED', 'NOT_QUALIFIED', 'APPOINTMENT_SET', 'QUALIFIER_CALLBACK', 'NO_CONTACT'].includes(l.status)
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

  const leads = await prisma.lead.findMany({
    where: {
      assignedAgentId: agentId,
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
    NOT_QUALIFIED: 'DNQ',
    APPOINTMENT_SET: 'Appointment Set',
    NO_CONTACT: 'No Contact',
    QUALIFIER_CALLBACK: 'Callback',
  };

  const byStatus: Record<string, number> = {};
  for (const lead of leads) {
    byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
  }

  const order = ['NEW', 'CONTACTED', 'INTERESTED', 'QUALIFYING', 'QUALIFIED', 'APPOINTMENT_SET', 'QUALIFIER_CALLBACK', 'NO_CONTACT', 'NOT_INTERESTED', 'DEPOSITION', 'NOT_QUALIFIED'];
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

/** Agent-specific: Summary stats (leads assigned to agent) */
export async function getAgentSummaryReport(agentId: string, weeksBack = 4) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7 * weeksBack);

  const leads = await prisma.lead.findMany({
    where: {
      assignedAgentId: agentId,
      createdAt: { gte: from, lte: to },
    },
    select: { status: true },
  });

  const total = leads.length;
  const sentToQualifier = leads.filter((l) => l.status === LeadStatus.QUALIFYING).length;
  const depositions = leads.filter(
    (l) => l.status === LeadStatus.DEPOSITION || l.status === LeadStatus.NOT_INTERESTED
  ).length;
  const appointmentSet = leads.filter((l) => l.status === LeadStatus.APPOINTMENT_SET).length;
  const inPipeline = leads.filter((l) => ['NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIER_CALLBACK', 'NO_CONTACT'].includes(l.status)).length;

  return {
    totalLeads: total,
    sentToQualifier,
    depositions,
    appointmentSet,
    inPipeline,
    conversionRate: total > 0 ? Math.round((sentToQualifier / total) * 100) : 0,
  };
}

/** Appointment Outcomes (Looker-style): High % to sell, Future Appointment, Appt Not Sat */
export async function getAppointmentOutcomesReport(weeksBack = 4) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7 * weeksBack);

  const appointments = await prisma.appointment.findMany({
    where: { createdAt: { gte: from, lte: to } },
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
