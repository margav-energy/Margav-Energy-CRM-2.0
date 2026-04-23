/**
 * SMS Lead Journey - state-driven workflow service.
 * Orchestrates: initial SMS → office/outside hours branching → qualifier tasks → appointment → outcomes.
 */

import {
  LeadStatus,
  SmsAutomationStage,
  CallOutcome,
  AppointmentOutcome,
  TaskType,
  TaskStatus,
  TaskPriority,
  AppointmentStatus,
} from '@prisma/client';
import { prisma } from '../../db';
import { AppError } from '../../middleware/errorHandler';
import { isWithinOfficeHours, getNextOfficeHoursStart, getNextDayOfficeHoursStart, getOfficeHoursStartInDays } from '../../lib/businessHours';
import { sendSms as providerSendSms } from '../../lib/smsProvider';
import { config } from '../../config';

/** When true, automated outbound SMS and journey-driven tasks from this service are skipped (admin-controlled). */
export function isSmsAutomationPaused(lead: { smsAutomationPaused?: boolean | null }): boolean {
  return lead.smsAutomationPaused === true;
}

/** Task due offset: in `SMS_JOURNEY_TEST_MODE`, `units` are seconds; otherwise minutes. */
function delayUnitsToMs(units: number): number {
  return config.smsJourneyTestMode ? units * 1000 : units * 60 * 1000;
}

/** Replaces multi-hour "next office hours" waits with a short test delay (seconds). */
function deferredCallbackDelayUnits(): number {
  if (config.smsJourneyTestMode) {
    return Math.max(1, config.smsJourneyTestDeferredCallbackSec);
  }
  return Math.max(1, Math.round((getNextOfficeHoursStart().getTime() - Date.now()) / 60000));
}

// --- Activity event types for audit timeline ---
export const ACTIVITY_EVENT_TYPES = {
  INITIAL_SMS_SENT: 'INITIAL_SMS_SENT',
  QUALIFIER_TASK_CREATED: 'QUALIFIER_TASK_CREATED',
  CHASE_CALL_TASK_CREATED: 'CHASE_CALL_TASK_CREATED',
  INBOUND_REPLY_RECEIVED: 'INBOUND_REPLY_RECEIVED',
  CALLBACK_TASK_CREATED: 'CALLBACK_TASK_CREATED',
  CALL_OUTCOME_LOGGED: 'CALL_OUTCOME_LOGGED',
  APPOINTMENT_BOOKED: 'APPOINTMENT_BOOKED',
  SURVEYOR_ON_ROUTE_SENT: 'SURVEYOR_ON_ROUTE_SENT',
  APPOINTMENT_OUTCOME_LOGGED: 'APPOINTMENT_OUTCOME_LOGGED',
} as const;

async function recordActivityEvent(
  leadId: string,
  eventType: string,
  metadata?: Record<string, unknown>
) {
  return prisma.activityEvent.create({
    data: {
      leadId,
      eventType,
      metadata: metadata ? (metadata as object) : undefined,
    },
  });
}

export async function getDefaultQualifierId(): Promise<string> {
  if (config.defaultQualifierId) {
    const user = await prisma.user.findUnique({
      where: { id: config.defaultQualifierId, role: 'QUALIFIER' },
    });
    if (user) return user.id;
  }
  const qualifier = await prisma.user.findFirst({
    where: { role: 'QUALIFIER' },
    select: { id: true },
  });
  if (!qualifier) {
    throw new AppError('No qualifier user found. Create a QUALIFIER user or set DEFAULT_QUALIFIER_ID.', 500);
  }
  return qualifier.id;
}

/**
 * Send initial SMS within 5 seconds of lead creation.
 * Idempotent: skips if INITIAL_SMS_SENT already recorded for this lead.
 */
export async function sendInitialSms(leadId: string): Promise<{
  sent: boolean;
  threadId?: string;
  stage: SmsAutomationStage;
}> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError('Lead not found', 404);

  if (isSmsAutomationPaused(lead)) {
    return {
      sent: false,
      stage: (lead.smsAutomationStage ?? SmsAutomationStage.INITIAL_SMS_PENDING) as SmsAutomationStage,
    };
  }

  // Idempotency: already sent?
  const existingEvent = await prisma.activityEvent.findFirst({
    where: { leadId, eventType: ACTIVITY_EVENT_TYPES.INITIAL_SMS_SENT },
  });
  if (existingEvent) {
    const thread = await prisma.smsThread.findFirst({
      where: { leadId, phone: lead.phone },
    });
    return {
      sent: false,
      threadId: thread?.id,
      stage: (lead.smsAutomationStage ?? SmsAutomationStage.INITIAL_SMS_SENT) as SmsAutomationStage,
    };
  }

  // Get or create thread
  let thread = await prisma.smsThread.findFirst({
    where: { leadId, phone: lead.phone },
  });
  if (!thread) {
    thread = await prisma.smsThread.create({
      data: { leadId, phone: lead.phone },
    });
  }

  const inOfficeHours = isWithinOfficeHours();
  const { startHour, endHour } = config.businessHours;
  const fmt = (h: number) => `${h === 0 ? 12 : h > 12 ? h - 12 : h}:00${h < 12 ? 'am' : 'pm'}`;
  const hoursDisplay = `${fmt(startHour)}-${fmt(endHour)}`;

  // SMS #1 (In-Hours) / SMS #2 (Out-of-Hours) — keep concise: Twilio trial allows 1 segment (~160 chars). No URLs.
  const messageBody = inOfficeHours
    ? `MarGav Solar: thanks for your solar enquiry. We'll call you soon.`
    : `MarGav: enquiry received. We're open ${hoursDisplay} — we'll call you then.`;

  const result = await providerSendSms(lead.phone, messageBody);
  const storedInitialBody = result.sentBody ?? messageBody;

  if (!result.success) {
    console.error('[SMS Journey] Initial SMS failed (Twilio). Lead not marked as sent — retry POST /api/sms-journey/send-initial/' + leadId, result.error);
    await prisma.smsMessage.create({
      data: {
        threadId: thread!.id,
        direction: 'OUTBOUND',
        body: storedInitialBody,
        deliveryStatus: 'FAILED',
        providerMessageId: result.providerMessageId ?? undefined,
      },
    });
    return {
      sent: false,
      threadId: thread.id,
      stage: (lead.smsAutomationStage ?? SmsAutomationStage.INITIAL_SMS_PENDING) as SmsAutomationStage,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.smsMessage.create({
      data: {
        threadId: thread!.id,
        direction: 'OUTBOUND',
        body: storedInitialBody,
        deliveryStatus: 'DELIVERED',
        providerMessageId: result.providerMessageId ?? undefined,
      },
    });
    await tx.smsThread.update({
      where: { id: thread!.id },
      data: { lastMessageAt: new Date() },
    });
    await tx.lead.update({
      where: { id: leadId },
      data: { smsAutomationStage: SmsAutomationStage.INITIAL_SMS_SENT },
    });
    await tx.activityEvent.create({
      data: {
        leadId,
        eventType: ACTIVITY_EVENT_TYPES.INITIAL_SMS_SENT,
        metadata: {
          inOfficeHours,
          providerMessageId: result.providerMessageId,
          bodyPreview: messageBody.slice(0, 50),
        },
      },
    });
  });

  // Branch: office hours → callback task; outside hours → await reply or chase
  if (inOfficeHours) {
    await createCallbackTask(leadId, config.qualifierCallbackMinutes);
  } else {
    await prisma.lead.update({
      where: { id: leadId },
      data: { smsAutomationStage: SmsAutomationStage.AWAITING_REPLY },
    });
  }

  return {
    sent: true,
    threadId: thread.id,
    stage: inOfficeHours ? SmsAutomationStage.AWAITING_QUALIFIER : SmsAutomationStage.AWAITING_REPLY,
  };
}

/**
 * Create qualifier callback task. Idempotent by event type + lead.
 */
export async function createCallbackTask(
  leadId: string,
  dueInMinutes: number,
  taskType: 'QUALIFIER_CALLBACK' | 'CHASE_CALL' | 'CALLBACK_TASK' = 'QUALIFIER_CALLBACK'
): Promise<{ taskId: string }> {
  const eventType =
    taskType === 'CHASE_CALL'
      ? ACTIVITY_EVENT_TYPES.CHASE_CALL_TASK_CREATED
      : taskType === 'CALLBACK_TASK'
      ? ACTIVITY_EVENT_TYPES.CALLBACK_TASK_CREATED
      : ACTIVITY_EVENT_TYPES.QUALIFIER_TASK_CREATED;

  const existing = await prisma.activityEvent.findFirst({
    where: { leadId, eventType },
  });
  if (existing) {
    const task = await prisma.task.findFirst({
      where: { leadId, type: 'CALL' },
      orderBy: { createdAt: 'desc' },
    });
    if (task) return { taskId: task.id };
  }

  const qualifierId = await getDefaultQualifierId();
  const dueDate = new Date(Date.now() + delayUnitsToMs(dueInMinutes));

  const titles: Record<string, string> = {
    QUALIFIER_CALLBACK: 'Qualifier callback - urgent',
    CHASE_CALL: 'Chase call - no SMS reply',
    CALLBACK_TASK: 'Callback - customer replied outside hours',
  };
  const task = await prisma.task.create({
    data: {
      title: titles[taskType] ?? 'Qualifier callback',
      description: 'Call lead from SMS journey. Log outcome: WRONG_NUMBER, NOT_INTERESTED, APPOINTMENT_BOOKED, NO_ANSWER, CALLBACK_REQUESTED',
      type: TaskType.CALL,
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      dueDate,
      assignedToUserId: qualifierId,
      createdByUserId: qualifierId,
      leadId,
    },
  });

  // SMS #9: Callback confirmation (skip for CHASE_CALL - we send SMS #3 instead); skip all if automation paused
  if (taskType !== 'CHASE_CALL') {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead && !isSmsAutomationPaused(lead)) {
      const thread = await prisma.smsThread.findFirst({
        where: { leadId, phone: lead.phone },
      });
      if (thread) {
        const cbDate = dueDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        const cbTime = dueDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const sms9Body = `Callback ${cbDate} ${cbTime}. MarGav Solar`;
        const result = await providerSendSms(lead.phone, sms9Body);
        await prisma.smsMessage.create({
          data: {
            threadId: thread.id,
            direction: 'OUTBOUND',
            body: result.sentBody ?? sms9Body,
            deliveryStatus: result.success ? 'DELIVERED' : 'FAILED',
            providerMessageId: result.providerMessageId ?? undefined,
          },
        });
        await prisma.smsThread.update({
          where: { id: thread.id },
          data: { lastMessageAt: new Date() },
        });
      }
    }
  }

  await recordActivityEvent(leadId, eventType, {
    taskId: task.id,
    dueInMinutes,
    dueDate: dueDate.toISOString(),
  });

  return { taskId: task.id };
}

/**
 * Handle opt-out: STOP, UNSUBSCRIBE, etc. Archives thread and stops automation.
 */
export async function handleOptOut(fromPhone: string): Promise<{ optedOut: boolean }> {
  const phoneDigits = fromPhone.replace(/\D/g, '');
  const searchSuffix = phoneDigits.slice(-10);
  const threads = await prisma.smsThread.findMany({
    where: { status: 'ACTIVE' },
    include: { lead: { select: { phone: true } } },
  });
  const thread = threads.find((t) => {
    const leadDigits = t.phone.replace(/\D/g, '');
    return leadDigits.endsWith(searchSuffix) || searchSuffix.endsWith(leadDigits);
  });
  if (!thread) return { optedOut: false };

  await prisma.$transaction([
    prisma.smsThread.update({
      where: { id: thread.id },
      data: { status: 'ARCHIVED' },
    }),
    prisma.lead.update({
      where: { id: thread.leadId },
      data: { smsAutomationStage: SmsAutomationStage.COMPLETED },
    }),
  ]);
  return { optedOut: true };
}

/**
 * Handle inbound SMS from customer.
 * Outside hours flow: save reply, create callback for next office hours.
 */
export async function handleInboundSms(
  leadId: string,
  body: string,
  providerMessageId?: string
): Promise<{ createdCallback: boolean }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError('Lead not found', 404);

  // Idempotency: same provider message?
  if (providerMessageId) {
    const existing = await prisma.smsMessage.findFirst({
      where: { providerMessageId },
    });
    if (existing) return { createdCallback: false };
  }

  let thread = await prisma.smsThread.findFirst({
    where: { leadId, phone: lead.phone },
  });
  if (!thread) {
    // Thread may not exist if sendInitialSms was never called, or phone format differs
    thread = await prisma.smsThread.findFirst({
      where: { leadId },
    });
  }
  if (!thread) {
    thread = await prisma.smsThread.create({
      data: { leadId, phone: lead.phone },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.smsMessage.create({
      data: {
        threadId: thread.id,
        direction: 'INBOUND',
        body,
        deliveryStatus: 'DELIVERED',
        providerMessageId: providerMessageId ?? undefined,
      },
    });
    await tx.smsThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt: new Date(),
        customerReplyAt: new Date(),
        qualifyingQuestionsReply: body,
      },
    });
  });

  await recordActivityEvent(leadId, ACTIVITY_EVENT_TYPES.INBOUND_REPLY_RECEIVED, {
    bodyPreview: body.slice(0, 100),
    providerMessageId,
  });

  if (isSmsAutomationPaused(lead)) {
    return { createdCallback: false };
  }

  const bodyUpper = body.trim().toUpperCase();

  // BOOK: confirm booking (survey details shared elsewhere — no link in SMS)
  if (bodyUpper === 'BOOK') {
    const surveyBody = `MarGav: thanks — your booking is noted. We'll confirm your survey visit with you directly.`;
    const surveyResult = await providerSendSms(lead.phone, surveyBody);
    await prisma.smsMessage.create({
      data: {
        threadId: thread.id,
        direction: 'OUTBOUND',
        body: surveyResult.sentBody ?? surveyBody,
        deliveryStatus: surveyResult.success ? 'DELIVERED' : 'FAILED',
        providerMessageId: surveyResult.providerMessageId ?? undefined,
      },
    });
    await prisma.smsThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });
    return { createdCallback: false };
  }

  // QUALIFIER: speak to qualifier first - create callback task and notify qualifier
  if (bodyUpper === 'QUALIFIER') {
    const dueInMinutes = isWithinOfficeHours()
      ? config.qualifierCallbackMinutes
      : deferredCallbackDelayUnits();
    await createCallbackTask(leadId, dueInMinutes, isWithinOfficeHours() ? 'QUALIFIER_CALLBACK' : 'CALLBACK_TASK');
    await prisma.lead.update({
      where: { id: leadId },
      data: { smsAutomationStage: isWithinOfficeHours() ? SmsAutomationStage.AWAITING_QUALIFIER : SmsAutomationStage.REPLY_RECEIVED },
    });
    const qualifierMsg = isWithinOfficeHours()
      ? config.smsJourneyTestMode
        ? `A team member will call you within ${config.qualifierCallbackMinutes}s (test).`
        : `A team member will call you within ${config.qualifierCallbackMinutes} minutes.`
      : `We'll call you when we open. Thanks!`;
    const qResult = await providerSendSms(lead.phone, qualifierMsg);

    // Send lead details to qualifier's phone
    if (config.qualifierPhoneNumber) {
      const qualifierAlert = `MarGav: New lead wants qualifier call - ${lead.firstName} ${lead.lastName}, ${lead.phone}, ${lead.email}${lead.postcode ? `, ${lead.postcode}` : ''}. Call within ${config.qualifierCallbackMinutes} min.`;
      providerSendSms(config.qualifierPhoneNumber, qualifierAlert).catch((err) =>
        console.error('[SMS Journey] Failed to notify qualifier:', err)
      );
    }
    await prisma.smsMessage.create({
      data: {
        threadId: thread.id,
        direction: 'OUTBOUND',
        body: qResult.sentBody ?? qualifierMsg,
        deliveryStatus: qResult.success ? 'DELIVERED' : 'FAILED',
        providerMessageId: qResult.providerMessageId ?? undefined,
      },
    });
    await prisma.smsThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });
    return { createdCallback: true };
  }

  // If awaiting reply (outside hours flow), create callback for next office hours
  const createdCallback = lead.smsAutomationStage === SmsAutomationStage.AWAITING_REPLY;
  if (createdCallback) {
    await createCallbackTask(leadId, deferredCallbackDelayUnits(), 'CALLBACK_TASK');
    await prisma.lead.update({
      where: { id: leadId },
      data: { smsAutomationStage: SmsAutomationStage.REPLY_RECEIVED },
    });
  }

  return { createdCallback };
}

/**
 * Process all leads in AWAITING_REPLY for >72h - create chase call tasks.
 * Call from cron: e.g. every hour. Idempotent per lead.
 */
export async function processNoReplyLeads(hoursThreshold = 72): Promise<{ processed: number; taskIds: string[] }> {
  const cutoff = config.smsJourneyTestMode
    ? new Date(Date.now() - hoursThreshold * 1000)
    : new Date(Date.now() - hoursThreshold * 60 * 60 * 1000);
  const leads = await prisma.lead.findMany({
    where: {
      smsAutomationStage: SmsAutomationStage.AWAITING_REPLY,
      smsAutomationPaused: false,
      smsThreads: {
        some: {
          lastMessageAt: { lte: cutoff },
          customerReplyAt: null,
        },
      },
    },
    select: { id: true },
  });

  const taskIds: string[] = [];
  for (const lead of leads) {
    const result = await createChaseCallTaskForNoReply(lead.id);
    if (result.taskId) taskIds.push(result.taskId);
  }
  return { processed: leads.length, taskIds };
}

/**
 * Create chase call task when customer doesn't reply within 72h (outside hours flow).
 * Call this from a scheduled job/cron. Idempotent.
 * Sends SMS #3 (follow-up) when creating chase call.
 */
export async function createChaseCallTaskForNoReply(leadId: string): Promise<{ taskId?: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError('Lead not found', 404);
  if (isSmsAutomationPaused(lead) || lead.smsAutomationStage !== SmsAutomationStage.AWAITING_REPLY) {
    return {};
  }

  const { taskId } = await createCallbackTask(leadId, deferredCallbackDelayUnits(), 'CHASE_CALL');
  await prisma.lead.update({
    where: { id: leadId },
    data: { smsAutomationStage: SmsAutomationStage.CHASE_CALL_DUE },
  });

  // SMS #3: Follow-up – if no reply / missed call
  const sms3Body = `MarGav follow-up: still interested in solar? Reply when you can.`;
  const thread = await prisma.smsThread.findFirst({ where: { leadId, phone: lead.phone } });
  if (thread) {
    const result = await providerSendSms(lead.phone, sms3Body);
    await prisma.smsMessage.create({
      data: {
        threadId: thread.id,
        direction: 'OUTBOUND',
        body: result.sentBody ?? sms3Body,
        deliveryStatus: result.success ? 'DELIVERED' : 'FAILED',
        providerMessageId: result.providerMessageId ?? undefined,
      },
    });
    await prisma.smsThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });
  }

  return { taskId };
}

/**
 * Send SMS #4 (next working day follow-up) for CHASE_CALL_DUE leads with no reply.
 * Call from cron daily. Idempotent per lead (track via activity event).
 */
export async function sendNextDayFollowUpSms(): Promise<{ sent: number }> {
  const lookbackMs = config.smsJourneyTestMode
    ? config.smsJourneyTestChaseFollowupSec * 1000
    : 24 * 60 * 60 * 1000;
  const oneDayAgo = new Date(Date.now() - lookbackMs);
  const leads = await prisma.lead.findMany({
    where: {
      smsAutomationStage: SmsAutomationStage.CHASE_CALL_DUE,
      smsAutomationPaused: false,
      smsThreads: {
        some: {
          lastMessageAt: { lte: oneDayAgo },
          customerReplyAt: null,
        },
      },
    },
    include: { smsThreads: { where: { status: 'ACTIVE' }, take: 1 } },
  });

  let sent = 0;
  for (const lead of leads) {
    const alreadySent = await prisma.activityEvent.findFirst({
      where: { leadId: lead.id, eventType: 'SMS_4_NEXT_DAY_FOLLOWUP_SENT' },
    });
    if (alreadySent) continue;

    const thread = lead.smsThreads[0];
    if (!thread) continue;

    const sms4Body = `MarGav: still interested? Reply YES when you're ready.`;
    const result = await providerSendSms(lead.phone, sms4Body);
    await prisma.smsMessage.create({
      data: {
        threadId: thread.id,
        direction: 'OUTBOUND',
        body: result.sentBody ?? sms4Body,
        deliveryStatus: result.success ? 'DELIVERED' : 'FAILED',
        providerMessageId: result.providerMessageId ?? undefined,
      },
    });
    await prisma.smsThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });
    await recordActivityEvent(lead.id, 'SMS_4_NEXT_DAY_FOLLOWUP_SENT', {});
    sent++;
  }
  return { sent };
}

/**
 * In-house office hours NO_CONTACT flow: send SMS and schedule next agent call.
 * Attempt 1: SMS #3, call in 2h | Attempt 2: SMS #4, call in 2h | Attempt 3: SMS #5, call next day | Attempt 4: re-route 14 days
 */
async function handleNoContactFlow(leadId: string, userId?: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  if (isSmsAutomationPaused(lead)) return;

  const noAnswerCount = await prisma.callLog.count({
    where: { leadId, outcome: CallOutcome.NO_ANSWER },
  });

  const thread = await prisma.smsThread.findFirst({ where: { leadId, phone: lead.phone } });
  if (!thread) return;

  const sendSmsAndCreateTask = async (body: string, dueDate: Date, taskTitle: string) => {
    const result = await providerSendSms(lead.phone, body);
    await prisma.smsMessage.create({
      data: {
        threadId: thread!.id,
        direction: 'OUTBOUND',
        body: result.sentBody ?? body,
        deliveryStatus: result.success ? 'DELIVERED' : 'FAILED',
        providerMessageId: result.providerMessageId ?? undefined,
      },
    });
    await prisma.smsThread.update({
      where: { id: thread!.id },
      data: { lastMessageAt: new Date() },
    });
    const qualifierId = await getDefaultQualifierId();
    await prisma.task.create({
      data: {
        title: taskTitle,
        description: 'NO_CONTACT follow-up call. Log outcome via call-outcome.',
        type: TaskType.CALL,
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        dueDate,
        assignedToUserId: qualifierId,
        createdByUserId: userId ?? qualifierId,
        leadId,
      },
    });
  };

  const sms3Body = `MarGav follow-up: still interested in solar? Reply when you can.`;
  const sms4Body = `MarGav: still interested? Reply YES when you're ready.`;
  const sms5Body = `MarGav: still here to help. Reply when it suits you.`;

  const noContactFollowMs = config.smsJourneyTestMode
    ? config.smsJourneyTestNoContactDelaySec * 1000
    : 2 * 60 * 60 * 1000;
  if (noAnswerCount === 1) {
    const due2h = new Date(Date.now() + noContactFollowMs);
    await sendSmsAndCreateTask(sms3Body, due2h, 'NO_CONTACT follow-up (2h)');
  } else if (noAnswerCount === 2) {
    const due2h = new Date(Date.now() + noContactFollowMs);
    await sendSmsAndCreateTask(sms4Body, due2h, 'NO_CONTACT follow-up (4h)');
  } else if (noAnswerCount === 3) {
    const dueNextDay = getNextDayOfficeHoursStart();
    await sendSmsAndCreateTask(sms5Body, dueNextDay, 'NO_CONTACT follow-up (next day)');
  } else if (noAnswerCount >= 4) {
    const due14d = getOfficeHoursStartInDays(14);
    const qualifierId = await getDefaultQualifierId();
    await prisma.task.create({
      data: {
        title: 'NO_CONTACT re-route (14 days)',
        description: 'Re-route lead after 4th no-contact. Call and log outcome.',
        type: TaskType.CALL,
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        dueDate: due14d,
        assignedToUserId: qualifierId,
        createdByUserId: userId ?? qualifierId,
        leadId,
      },
    });
  }
}

/**
 * Log qualifier call outcome. Updates lead status and automation stage.
 * NO_ANSWER triggers in-house NO_CONTACT flow: SMS #3→#4→#5 + re-route 14 days.
 */
export async function logCallOutcome(
  leadId: string,
  outcome: CallOutcome,
  notes?: string,
  userId?: string
): Promise<{ callLogId: string; appointmentId?: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError('Lead not found', 404);

  const callLog = await prisma.callLog.create({
    data: {
      leadId,
      outcome,
      notes,
      createdByUserId: userId ?? undefined,
    },
  });

  await recordActivityEvent(leadId, ACTIVITY_EVENT_TYPES.CALL_OUTCOME_LOGGED, {
    callLogId: callLog.id,
    outcome,
  });

  const statusMap: Partial<Record<CallOutcome, LeadStatus>> = {
    WRONG_NUMBER: LeadStatus.NOT_INTERESTED,
    NOT_INTERESTED: LeadStatus.NOT_INTERESTED,
    NO_ANSWER: LeadStatus.NO_CONTACT,
    CALLBACK_REQUESTED: LeadStatus.QUALIFYING,
  };

  if (outcome === CallOutcome.APPOINTMENT_BOOKED) {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: LeadStatus.APPOINTMENT_SET,
        smsAutomationStage: SmsAutomationStage.APPOINTMENT_BOOKED,
      },
    });
    return { callLogId: callLog.id };
  }

  if (outcome === CallOutcome.NO_ANSWER) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.NO_CONTACT },
    });
    await handleNoContactFlow(leadId, userId);
    return { callLogId: callLog.id };
  }

  if (outcome === CallOutcome.CALLBACK_REQUESTED) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.QUALIFIER_CALLBACK },
    });
    await createCallbackTask(leadId, config.qualifierCallbackMinutes, 'QUALIFIER_CALLBACK');
    return { callLogId: callLog.id };
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: statusMap[outcome] ?? lead.status,
      smsAutomationStage: SmsAutomationStage.COMPLETED,
    },
  });

  return { callLogId: callLog.id };
}

/**
 * Book appointment (from qualifier or after callback).
 * Creates appointment, updates lead, marks thread as booked via SMS.
 */
export async function bookAppointment(
  leadId: string,
  fieldSalesRepId: string,
  scheduledAt: Date,
  notes?: string
): Promise<{ appointmentId: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError('Lead not found', 404);

  const appointment = await prisma.appointment.create({
    data: {
      leadId,
      fieldSalesRepId,
      scheduledAt,
      notes,
      status: AppointmentStatus.SCHEDULED,
    },
  });

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: {
        status: LeadStatus.APPOINTMENT_SET,
        smsAutomationStage: SmsAutomationStage.APPOINTMENT_BOOKED,
        assignedFieldSalesRepId: fieldSalesRepId,
      },
    }),
    prisma.smsThread.updateMany({
      where: { leadId },
      data: { bookedViaSms: true },
    }),
  ]);

  await recordActivityEvent(leadId, ACTIVITY_EVENT_TYPES.APPOINTMENT_BOOKED, {
    appointmentId: appointment.id,
    fieldSalesRepId,
    scheduledAt: scheduledAt.toISOString(),
  });

  // SMS #6: Appointment Confirmation
  const apptDate = scheduledAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const apptTime = scheduledAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sms6Body = `Appt confirmed: ${apptDate} ${apptTime}. MarGav Solar`;
  const apptThread = await prisma.smsThread.findFirst({
    where: { leadId, phone: lead.phone },
  });
  if (apptThread && !isSmsAutomationPaused(lead)) {
    const apptResult = await providerSendSms(lead.phone, sms6Body);
    await prisma.smsMessage.create({
      data: {
        threadId: apptThread.id,
        direction: 'OUTBOUND',
        body: apptResult.sentBody ?? sms6Body,
        deliveryStatus: apptResult.success ? 'DELIVERED' : 'FAILED',
        providerMessageId: apptResult.providerMessageId ?? undefined,
      },
    });
    await prisma.smsThread.update({
      where: { id: apptThread.id },
      data: { lastMessageAt: new Date() },
    });
  }

  return { appointmentId: appointment.id };
}

/**
 * Send SMS #7: Appointment reminder (day before). Call from cron daily.
 */
export async function sendAppointmentReminders(): Promise<{ sent: number }> {
  const now = new Date();

  const appointments = config.smsJourneyTestMode
    ? await prisma.appointment.findMany({
        where: {
          status: AppointmentStatus.SCHEDULED,
          scheduledAt: {
            gte: now,
            lte: new Date(Date.now() + config.smsJourneyTestApptReminderWindowSec * 1000),
          },
        },
        include: { lead: true, fieldSalesRep: true },
      })
    : await (async () => {
        const tomorrowStart = new Date(now);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        tomorrowStart.setHours(0, 0, 0, 0);
        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setHours(23, 59, 59, 999);
        return prisma.appointment.findMany({
          where: {
            status: AppointmentStatus.SCHEDULED,
            scheduledAt: { gte: tomorrowStart, lte: tomorrowEnd },
          },
          include: { lead: true, fieldSalesRep: true },
        });
      })();

  let sent = 0;
  for (const apt of appointments) {
    if (isSmsAutomationPaused(apt.lead)) continue;
    const thread = await prisma.smsThread.findFirst({
      where: { leadId: apt.leadId, phone: apt.lead.phone },
    });
    if (!thread) continue;

    const timeStr = apt.scheduledAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const repFull = apt.fieldSalesRep?.fullName ?? 'our team';
    const repName = repFull.length > 24 ? repFull.slice(0, 22) + '..' : repFull;
    const sms7Body = `Tomorrow ${timeStr} surveyor ${repName}. MarGav Solar`;
    const result = await providerSendSms(apt.lead.phone, sms7Body);
    await prisma.smsMessage.create({
      data: {
        threadId: thread.id,
        direction: 'OUTBOUND',
        body: result.sentBody ?? sms7Body,
        deliveryStatus: result.success ? 'DELIVERED' : 'FAILED',
        providerMessageId: result.providerMessageId ?? undefined,
      },
    });
    await prisma.smsThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    });
    sent++;
  }
  return { sent };
}

/**
 * Send SMS #8 for appointments in ~1 hour. Call from cron (e.g. every 15 mins).
 * In-house flow: "Your Surveyor is on-route (1 hour before appt)".
 */
export async function sendSurveyorOnRouteReminders(): Promise<{ sent: number }> {
  const now = new Date();

  const appointments = config.smsJourneyTestMode
    ? await prisma.appointment.findMany({
        where: {
          status: AppointmentStatus.SCHEDULED,
          scheduledAt: {
            gte: new Date(Date.now() + 1000),
            lte: new Date(Date.now() + config.smsJourneyTestSurveyorWindowSec * 1000),
          },
          surveyorOnRouteSentAt: null,
        },
        include: { lead: true, fieldSalesRep: true },
      })
    : await (async () => {
        const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
        const windowStart = new Date(inOneHour.getTime() - 15 * 60 * 1000);
        const windowEnd = new Date(inOneHour.getTime() + 15 * 60 * 1000);
        return prisma.appointment.findMany({
          where: {
            status: AppointmentStatus.SCHEDULED,
            scheduledAt: { gte: windowStart, lte: windowEnd },
            surveyorOnRouteSentAt: null,
          },
          include: { lead: true, fieldSalesRep: true },
        });
      })();

  let sent = 0;
  for (const apt of appointments) {
    const result = await sendSurveyorOnRouteSms(apt.id);
    if (result.sent) sent++;
  }
  return { sent };
}

/**
 * Send SMS #8: Surveyor on route. Idempotent per appointment.
 * Can be triggered by cron (1h before appt) or manually by field sales.
 */
export async function sendSurveyorOnRouteSms(appointmentId: string): Promise<{ sent: boolean }> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { lead: true, fieldSalesRep: { select: { fullName: true } } },
  });
  if (!appointment) throw new AppError('Appointment not found', 404);
  if (appointment.surveyorOnRouteSentAt) {
    return { sent: false };
  }
  if (isSmsAutomationPaused(appointment.lead)) {
    return { sent: false };
  }

  const thread = await prisma.smsThread.findFirst({
    where: { leadId: appointment.leadId, phone: appointment.lead.phone },
  });
  if (!thread) throw new AppError('SMS thread not found', 404);

  // SMS #8: Surveyor En Route
  const repFull = appointment.fieldSalesRep?.fullName ?? 'surveyor';
  const repName = repFull.length > 28 ? repFull.slice(0, 26) + '..' : repFull;
  const body = `Surveyor ${repName} on way. MarGav Solar`;
  const result = await providerSendSms(appointment.lead.phone, body);

  await prisma.$transaction([
    prisma.smsMessage.create({
      data: {
        threadId: thread.id,
        direction: 'OUTBOUND',
        body: result.sentBody ?? body,
        deliveryStatus: result.success ? 'DELIVERED' : 'FAILED',
        providerMessageId: result.providerMessageId ?? undefined,
      },
    }),
    prisma.smsThread.update({
      where: { id: thread.id },
      data: { lastMessageAt: new Date() },
    }),
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { surveyorOnRouteSentAt: new Date() },
    }),
  ]);

  await recordActivityEvent(appointment.leadId, ACTIVITY_EVENT_TYPES.SURVEYOR_ON_ROUTE_SENT, {
    appointmentId,
  });

  return { sent: true };
}

/**
 * Log final appointment outcome: PITCH_AND_MISS, SALE_WON, SWEEP.
 */
export async function logAppointmentOutcome(
  appointmentId: string,
  outcome: AppointmentOutcome,
  notes?: string
): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { lead: true },
  });
  if (!appointment) throw new AppError('Appointment not found', 404);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { outcome },
  });

  await recordActivityEvent(appointment.leadId, ACTIVITY_EVENT_TYPES.APPOINTMENT_OUTCOME_LOGGED, {
    appointmentId,
    outcome,
    notes,
  });

  await prisma.lead.update({
    where: { id: appointment.leadId },
    data: { smsAutomationStage: SmsAutomationStage.COMPLETED },
  });
}
