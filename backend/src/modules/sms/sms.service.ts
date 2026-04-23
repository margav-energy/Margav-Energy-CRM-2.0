/**
 * SMS Service - Twilio integration via smsProvider.
 */

import { prisma } from '../../db';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { sendSms as providerSendSms } from '../../lib/smsProvider';

export async function listThreads(params?: { search?: string; status?: 'ACTIVE' | 'ARCHIVED'; limit?: number }) {
  const limit = Math.min(Math.max(params?.limit ?? 50, 1), 200);
  const search = params?.search?.trim();
  const where: Record<string, unknown> = {};

  if (params?.status) {
    where.status = params.status;
  }

  if (search) {
    where.OR = [
      { phone: { contains: search } },
      { lead: { firstName: { contains: search, mode: 'insensitive' } } },
      { lead: { lastName: { contains: search, mode: 'insensitive' } } },
      { lead: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const threads = await prisma.smsThread.findMany({
    where,
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          smsAutomationStage: true,
        },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    take: limit,
  });

  return threads.map((thread) => ({
    id: thread.id,
    leadId: thread.leadId,
    phone: thread.phone,
    status: thread.status,
    lastMessageAt: thread.lastMessageAt,
    customerReplyAt: thread.customerReplyAt,
    bookedViaSms: thread.bookedViaSms,
    lead: thread.lead,
    lastMessage: thread.messages[0]
      ? {
          id: thread.messages[0].id,
          direction: thread.messages[0].direction,
          body: thread.messages[0].body,
          deliveryStatus: thread.messages[0].deliveryStatus,
          createdAt: thread.messages[0].createdAt,
        }
      : null,
  }));
}

export async function getOrCreateThread(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  let thread = await prisma.smsThread.findFirst({
    where: { leadId, phone: lead.phone },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });

  if (!thread) {
    thread = await prisma.smsThread.create({
      data: {
        leadId,
        phone: lead.phone,
      },
      include: { messages: true },
    });
  }

  return thread;
}

export async function getThreadById(threadId: string) {
  const thread = await prisma.smsThread.findUnique({
    where: { id: threadId },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!thread) {
    throw new AppError('SMS thread not found', 404);
  }

  return thread;
}

/**
 * Send SMS via Twilio (when configured). Creates message record and updates thread.
 */
export async function sendSms(threadId: string, body: string): Promise<{ success: boolean; message?: string }> {
  const thread = await prisma.smsThread.findUnique({ where: { id: threadId } });
  if (!thread) {
    throw new AppError('SMS thread not found', 404);
  }

  if (thread.status === 'ARCHIVED') {
    throw new AppError('Cannot send SMS: lead has opted out', 400);
  }

  const result = await providerSendSms(thread.phone, body);
  const storedBody = result.sentBody ?? body;

  await prisma.smsMessage.create({
    data: {
      threadId,
      direction: 'OUTBOUND',
      body: storedBody,
      deliveryStatus: result.success ? 'DELIVERED' : 'FAILED',
      providerMessageId: result.providerMessageId ?? undefined,
    },
  });

  await prisma.smsThread.update({
    where: { id: threadId },
    data: { lastMessageAt: new Date() },
  });

  if (!result.success) {
    return { success: false, message: result.error ?? 'SMS delivery failed' };
  }
  return { success: true };
}
