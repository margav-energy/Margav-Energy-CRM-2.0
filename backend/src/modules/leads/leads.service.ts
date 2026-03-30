import { LeadStatus } from '@prisma/client';
import { prisma } from '../../db';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateLeadInput,
  UpdateLeadInput,
  UpdateLeadStatusInput,
  ListLeadsQuery,
  ImportLeadInput,
  QualifyLeadInput,
  QUALIFIER_STATUS_MAP,
} from './leads.validation';
import { sendInitialSms } from '../smsLeadJourney/smsLeadJourney.service';

const leadInclude = {
  assignedAgent: { select: { id: true, fullName: true, email: true } },
  assignedQualifier: { select: { id: true, fullName: true, email: true } },
  assignedFieldSalesRep: { select: { id: true, fullName: true, email: true } },
  duplicateOfLead: { select: { id: true, firstName: true, lastName: true } },
  appointments: {
    where: { status: 'SCHEDULED' },
    orderBy: { scheduledAt: 'asc' },
    take: 1,
    include: { fieldSalesRep: { select: { fullName: true } } },
  },
};

export async function listLeads(query: ListLeadsQuery, userId: string, userRole: string) {
  const { page, pageSize, status, source, assignedAgentId, assignedQualifierId, assignedFieldSalesRepId, search } =
    query;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  // Agents only see leads assigned to them
  if (userRole === 'AGENT') {
    where.assignedAgentId = userId;
  } else if (assignedAgentId) {
    where.assignedAgentId = assignedAgentId;
  }
  if (assignedQualifierId) where.assignedQualifierId = assignedQualifierId;
  if (assignedFieldSalesRepId) where.assignedFieldSalesRepId = assignedFieldSalesRepId;

  if (status) where.status = status;
  if (source) where.source = source;

  if (search) {
    const searchLower = search.toLowerCase();
    where.OR = [
      { firstName: { contains: searchLower, mode: 'insensitive' as const } },
      { lastName: { contains: searchLower, mode: 'insensitive' as const } },
      { phone: { contains: search } },
      { email: { contains: searchLower, mode: 'insensitive' as const } },
      { postcode: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: leadInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return { items: leads, total, page, pageSize };
}

export async function getLeadById(id: string, userId?: string, userRole?: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: leadInclude,
  });

  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  // Agents can only access leads assigned to them
  if (userRole === 'AGENT' && lead.assignedAgentId !== userId) {
    throw new AppError('Lead not found', 404);
  }

  return lead;
}

export async function createLead(input: CreateLeadInput, userId: string) {
  const assignedAgentId = input.assignedAgentId || userId;
  const { assignedAgentId: _, status: inputStatus, ...rest } = input;
  const initialStatus = (inputStatus as LeadStatus) || LeadStatus.NEW;
  const lead = await prisma.lead.create({
    data: {
      ...rest,
      status: initialStatus,
      assignedAgentId,
    },
    include: leadInclude,
  });

  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      toStatus: initialStatus,
      changedByUserId: assignedAgentId,
      note: initialStatus === LeadStatus.QUALIFYING ? 'Lead created and sent to qualifier' : 'Lead created',
    },
  });

  // SMS Lead Journey: send initial SMS within 5 secs (async, non-blocking)
  setImmediate(() => {
    sendInitialSms(lead.id).catch((err) => {
      console.error('[SMS Journey] sendInitialSms failed for lead', lead.id, err);
    });
  });

  return lead;
}

/** Import lead from external source (Google Sheets, etc.). Uses default agent. Triggers SMS journey. */
export async function importLead(input: ImportLeadInput) {
  const agent = await prisma.user.findFirst({
    where: { role: 'AGENT' },
    select: { id: true },
  });
  const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
  const assignedAgentId = agent?.id ?? undefined;
  const changedByUserId = assignedAgentId ?? fallbackUser?.id;
  if (!changedByUserId) {
    throw new AppError('No user found. Create at least one user before importing leads.', 500);
  }

  const lead = await prisma.lead.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      phone: normalizePhoneForImport(input.phone),
      email: input.email,
      postcode: input.postcode,
      notes: input.notes,
      source: input.source ?? 'Import',
      status: LeadStatus.NEW,
      assignedAgentId,
    },
    include: leadInclude,
  });

  await prisma.leadStatusHistory.create({
    data: {
      leadId: lead.id,
      toStatus: LeadStatus.NEW,
      changedByUserId,
      note: 'Lead imported from external source',
    },
  });

  setImmediate(() => {
    sendInitialSms(lead.id).catch((err) => {
      console.error('[SMS Journey] sendInitialSms failed for imported lead', lead.id, err);
    });
  });

  return lead;
}

function normalizePhoneForImport(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 11) {
    return '+44' + digits.slice(1);
  }
  if (digits.length === 10 && !phone.startsWith('+')) {
    return '+44' + digits;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits;
  }
  return phone.startsWith('+') ? phone : '+' + digits;
}

export async function updateLead(id: string, input: UpdateLeadInput, userId?: string, userRole?: string) {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Lead not found', 404);
  }
  if (userRole === 'AGENT' && existing.assignedAgentId !== userId) {
    throw new AppError('Lead not found', 404);
  }

  if (input.duplicateOfLeadId !== undefined && input.duplicateOfLeadId !== null) {
    if (input.duplicateOfLeadId === id) {
      throw new AppError('A lead cannot be marked as a duplicate of itself', 400);
    }
    const master = await prisma.lead.findUnique({ where: { id: input.duplicateOfLeadId } });
    if (!master) {
      throw new AppError('Canonical lead not found', 404);
    }
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: input,
    include: leadInclude,
  });

  return lead;
}

export async function updateLeadStatus(
  id: string,
  input: UpdateLeadStatusInput,
  userId: string,
  userRole?: string
) {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Lead not found', 404);
  }
  if (userRole === 'AGENT' && existing.assignedAgentId !== userId) {
    throw new AppError('Lead not found', 404);
  }

  const lead = await prisma.lead.update({
    where: { id },
    data: { status: input.status as LeadStatus },
    include: leadInclude,
  });

  await prisma.leadStatusHistory.create({
    data: {
      leadId: id,
      fromStatus: existing.status,
      toStatus: input.status as LeadStatus,
      changedByUserId: userId,
      note: input.note,
    },
  });

  return lead;
}

export async function getLeadHistory(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  const history = await prisma.leadStatusHistory.findMany({
    where: { leadId: id },
    include: {
      changedByUser: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return history;
}

export type ActivityItem =
  | { type: 'status_change'; id: string; createdAt: Date; fromStatus: string | null; toStatus: string; changedBy: { fullName: string }; note?: string }
  | { type: 'sms'; id: string; createdAt: Date; direction: string; body: string }
  | { type: 'activity'; id: string; createdAt: Date; eventType: string; metadata?: unknown }
  | { type: 'note'; id: string; createdAt: Date; content: string; createdBy: { fullName: string } }
  | { type: 'task'; id: string; createdAt: Date; title: string; status: string; dueDate: Date; assignedTo: { fullName: string } }
  | { type: 'call'; id: string; createdAt: Date; outcome: string; notes?: string; createdBy?: { fullName: string } | null };

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }
  return { firstName: fullName.trim() || 'Unknown', lastName: 'Lead' };
}

const QUALIFIER_SECTION = '--- QUALIFIER NOTES ---';

function mergeNotes(agentNotes: string, qualifierNotes: string): string {
  if (!qualifierNotes?.trim()) return agentNotes || '';
  const agent = (agentNotes || '').trim();
  const idx = agent.indexOf(QUALIFIER_SECTION);
  const agentOnly = idx >= 0 ? agent.slice(0, idx).trim() : agent;
  return `${agentOnly}\n\n${QUALIFIER_SECTION}\n${qualifierNotes.trim()}`;
}

export async function qualifyLead(
  id: string,
  input: QualifyLeadInput,
  userId: string
): Promise<{ lead: Awaited<ReturnType<typeof getLeadById>>; calendar_synced?: boolean }> {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Lead not found', 404);
  }

  const margavStatus = (QUALIFIER_STATUS_MAP[input.status] ?? input.status.toUpperCase().replace(/\s/g, '_')) as LeadStatus;

  const { firstName, lastName } = input.full_name
    ? splitName(input.full_name)
    : { firstName: existing.firstName, lastName: existing.lastName };

  const agentNotes = (existing.notes || '').trim();
  const idx = agentNotes.indexOf(QUALIFIER_SECTION);
  const agentOnly = idx >= 0 ? agentNotes.slice(0, idx).trim() : agentNotes;
  const mergedNotes = mergeNotes(agentOnly, input.qualifier_notes || '');

  const updateData: Record<string, unknown> = {
    firstName,
    lastName,
    phone: input.phone ?? existing.phone,
    email: input.email ?? existing.email,
    addressLine1: input.address1 ?? existing.addressLine1,
    postcode: input.postal_code ?? existing.postcode,
    notes: mergedNotes,
    status: margavStatus,
    qualifierNotes: input.qualifier_notes || null,
    qualifierCallbackDate: input.qualifier_callback_date ? new Date(input.qualifier_callback_date) : null,
    assignedFieldSalesRepId: input.field_sales_rep || null,
    desktopRoofCheckCompleted: input.desktop_roof_check_completed ?? undefined,
    propertyTypeQualifier: input.property_type_qualifier || null,
    roofTypeQualifier: input.roof_type_qualifier || null,
    speakingToHomeowner: input.speaking_to_homeowner ?? undefined,
    bothHomeownersPresent: input.both_homeowners_present ?? undefined,
    propertyListed: input.property_listed ?? undefined,
    conservationArea: input.conservation_area ?? undefined,
    buildingWorkOngoing: input.building_work_ongoing ?? undefined,
    roofShadedObstructed: input.roof_shaded_obstructed ?? undefined,
    sprayFoamRoof: input.spray_foam_roof ?? undefined,
    customerAwareNoGrants: input.customer_aware_no_grants ?? undefined,
    currentElectricBillType: input.current_electric_bill_type || null,
    customerAge: input.customer_age ?? undefined,
    aged18To70: input.aged_18_70 ?? undefined,
    currentlyEmployed: input.currently_employed ?? undefined,
    hasGoodCredit: input.has_good_credit ?? undefined,
    earnsOver12k: input.earns_over_12k ?? undefined,
    planningToMove5Years: input.planning_to_move_5_years ?? undefined,
    available3WorkingDays: input.available_3_working_days ?? undefined,
  };

  const lead = await prisma.lead.update({
    where: { id },
    data: updateData,
    include: leadInclude,
  });

  await prisma.leadStatusHistory.create({
    data: {
      leadId: id,
      fromStatus: existing.status,
      toStatus: margavStatus,
      changedByUserId: userId,
      note: input.qualifier_notes || null,
    },
  });

  let calendarSynced = false;

  if (input.status === 'appointment_set' && input.appointment_date && input.field_sales_rep) {
    const { createAppointment } = await import('../appointments/appointments.service');
    await createAppointment({
      leadId: id,
      fieldSalesRepId: input.field_sales_rep,
      scheduledAt: input.appointment_date,
      notes: input.qualifier_notes || undefined,
    });
    calendarSynced = true; // TODO: integrate with Google Calendar API
  }

  if (input.status === 'qualifier_callback' && input.qualifier_callback_date) {
    const { createTask } = await import('../tasks/tasks.service');
    await createTask({
      title: `Qualifier Callback - ${lead.firstName} ${lead.lastName}`,
      description: input.qualifier_notes || undefined,
      type: 'CALL',
      priority: 'HIGH',
      dueDate: input.qualifier_callback_date,
      assignedToUserId: userId,
      leadId: id,
    });
  }

  return { lead, calendar_synced: calendarSynced };
}

export async function getLeadActivity(leadId: string): Promise<ActivityItem[]> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  const [statusHistory, activityEvents, notes, tasks, callLogs, smsMessages] = await Promise.all([
    prisma.leadStatusHistory.findMany({
      where: { leadId },
      include: { changedByUser: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.activityEvent.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.note.findMany({
      where: { leadId },
      include: { createdByUser: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.task.findMany({
      where: { leadId },
      include: { assignedToUser: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.callLog.findMany({
      where: { leadId },
      include: { createdByUser: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.smsMessage.findMany({
      where: { thread: { leadId } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const items: ActivityItem[] = [
    ...statusHistory.map((h) => ({
      type: 'status_change' as const,
      id: h.id,
      createdAt: h.createdAt,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedBy: h.changedByUser,
      note: h.note ?? undefined,
    })),
    ...smsMessages.map((m) => ({
      type: 'sms' as const,
      id: m.id,
      createdAt: m.createdAt,
      direction: m.direction,
      body: m.body,
    })),
    ...activityEvents.map((e) => ({
      type: 'activity' as const,
      id: e.id,
      createdAt: e.createdAt,
      eventType: e.eventType,
      metadata: e.metadata,
    })),
    ...notes.map((n) => ({
      type: 'note' as const,
      id: n.id,
      createdAt: n.createdAt,
      content: n.content,
      createdBy: n.createdByUser,
    })),
    ...tasks.map((t) => ({
      type: 'task' as const,
      id: t.id,
      createdAt: t.createdAt,
      title: t.title,
      status: t.status,
      dueDate: t.dueDate,
      assignedTo: t.assignedToUser,
    })),
    ...callLogs.map((c) => ({
      type: 'call' as const,
      id: c.id,
      createdAt: c.createdAt,
      outcome: c.outcome,
      notes: c.notes ?? undefined,
      createdBy: c.createdByUser,
    })),
  ];

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items;
}
