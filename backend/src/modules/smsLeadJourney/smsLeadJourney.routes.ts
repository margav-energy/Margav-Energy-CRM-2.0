/**
 * SMS Lead Journey routes.
 * Webhook is unauthenticated (Twilio); others require auth.
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireRoles } from '../../middleware';
import { sendSuccess } from '../../utils/apiResponse';
import { prisma } from '../../db';
import { Role } from '@prisma/client';
import * as journeyService from './smsLeadJourney.service';
import { z } from 'zod';

const router = Router();

// --- Webhook (no auth) - for Twilio inbound SMS ---
const webhookBodySchema = z.object({
  From: z.string().optional(),
  Body: z.string().optional(),
  MessageSid: z.string().optional(),
});

router.post('/webhook/inbound', async (req: Request, res: Response) => {
  try {
    const body = webhookBodySchema.parse(req.body);
    const from = body.From ?? '';
    const messageBody = (body.Body ?? '').trim();
    const providerMessageId = body.MessageSid;

    if (!from || !messageBody) {
      res.status(400).send('<Response></Response>');
      return;
    }

    // Opt-out: STOP, UNSUBSCRIBE, CANCEL, END, QUIT (case-insensitive)
    const optOutWords = ['stop', 'unsubscribe', 'cancel', 'end', 'quit'];
    const normalizedBody = messageBody.toLowerCase();
    if (optOutWords.some((w) => normalizedBody === w || normalizedBody.startsWith(w + ' '))) {
      const result = await journeyService.handleOptOut(from);
      if (result.optedOut) {
        console.log(`[SMS Webhook] Opt-out processed for ${from}`);
      }
      res.status(200).send('<Response></Response>');
      return;
    }

    // Find lead by phone (normalize: strip non-digits, match last 10 for US/UK)
    const phoneDigits = from.replace(/\D/g, '');
    const searchSuffix = phoneDigits.slice(-10); // Last 10 digits
    const allLeads = await prisma.lead.findMany({
      select: { id: true, phone: true },
    });
    const lead = allLeads.find((l) => {
      const leadDigits = l.phone.replace(/\D/g, '');
      return leadDigits.endsWith(searchSuffix) || searchSuffix.endsWith(leadDigits);
    });

    if (!lead) {
      console.warn(`[SMS Webhook] No lead found for phone: ${from}`);
      res.status(200).send('<Response></Response>');
      return;
    }

    await journeyService.handleInboundSms(lead.id, messageBody, providerMessageId);
    res.status(200).send('<Response></Response>');
  } catch (err) {
    console.error('[SMS Webhook] Error:', err);
    res.status(500).send('<Response></Response>');
  }
});

// --- Authenticated routes ---
router.use(authMiddleware);

router.post('/send-initial/:leadId', requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER), async (req: Request, res: Response) => {
  const result = await journeyService.sendInitialSms(req.params.leadId);
  sendSuccess(res, result);
});

router.post('/call-outcome', requireRoles(Role.ADMIN, Role.QUALIFIER), async (req: Request, res: Response) => {
  const { leadId, outcome, notes } = req.body;
  if (!leadId || !outcome) {
    res.status(400).json({ error: 'leadId and outcome are required' });
    return;
  }
  const validOutcomes = ['WRONG_NUMBER', 'NOT_INTERESTED', 'APPOINTMENT_BOOKED', 'NO_ANSWER', 'CALLBACK_REQUESTED'];
  if (!validOutcomes.includes(outcome)) {
    res.status(400).json({ error: `outcome must be one of: ${validOutcomes.join(', ')}` });
    return;
  }
  const result = await journeyService.logCallOutcome(leadId, outcome, notes, req.user?.userId);
  sendSuccess(res, result);
});

router.post('/book-appointment', requireRoles(Role.ADMIN, Role.QUALIFIER), async (req: Request, res: Response) => {
  const { leadId, fieldSalesRepId, scheduledAt, notes } = req.body;
  if (!leadId || !fieldSalesRepId || !scheduledAt) {
    res.status(400).json({ error: 'leadId, fieldSalesRepId, and scheduledAt are required' });
    return;
  }
  const result = await journeyService.bookAppointment(
    leadId,
    fieldSalesRepId,
    new Date(scheduledAt),
    notes
  );
  sendSuccess(res, result, 201);
});

router.post('/surveyor-on-route/:appointmentId', requireRoles(Role.ADMIN, Role.FIELD_SALES), async (req: Request, res: Response) => {
  const result = await journeyService.sendSurveyorOnRouteSms(req.params.appointmentId);
  sendSuccess(res, result);
});

router.post('/appointment-outcome', requireRoles(Role.ADMIN, Role.FIELD_SALES), async (req: Request, res: Response) => {
  const { appointmentId, outcome, notes } = req.body;
  if (!appointmentId || !outcome) {
    res.status(400).json({ error: 'appointmentId and outcome are required' });
    return;
  }
  const validOutcomes = ['PITCH_AND_MISS', 'SALE_WON', 'SWEEP'];
  if (!validOutcomes.includes(outcome)) {
    res.status(400).json({ error: `outcome must be one of: ${validOutcomes.join(', ')}` });
    return;
  }
  await journeyService.logAppointmentOutcome(appointmentId, outcome, notes);
  sendSuccess(res, { success: true });
});

router.post('/chase-call/:leadId', requireRoles(Role.ADMIN), async (req: Request, res: Response) => {
  const result = await journeyService.createChaseCallTaskForNoReply(req.params.leadId);
  sendSuccess(res, result);
});

router.post('/process-no-replies', requireRoles(Role.ADMIN), async (req: Request, res: Response) => {
  // When SMS_JOURNEY_TEST_MODE=true, `hours` is interpreted as **seconds** (not hours).
  const hours = req.body?.hours ?? 72;
  const result = await journeyService.processNoReplyLeads(hours);
  sendSuccess(res, result);
});

router.post('/cron/appointment-reminders', requireRoles(Role.ADMIN), async (req: Request, res: Response) => {
  const result = await journeyService.sendAppointmentReminders();
  sendSuccess(res, result);
});

router.post('/cron/next-day-followup', requireRoles(Role.ADMIN), async (req: Request, res: Response) => {
  const result = await journeyService.sendNextDayFollowUpSms();
  sendSuccess(res, result);
});

router.post('/cron/surveyor-on-route', requireRoles(Role.ADMIN), async (req: Request, res: Response) => {
  const result = await journeyService.sendSurveyorOnRouteReminders();
  sendSuccess(res, result);
});

export default router;
