/**
 * SMS Routes - placeholder for future Twilio webhooks and API.
 * Add webhook route when Twilio is configured:
 * POST /api/sms/webhook - Twilio status callbacks
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, requireRoles } from '../../middleware';
import * as smsService from './sms.service';
import { sendSuccess } from '../../utils/apiResponse';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES));

router.get('/threads', async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const status =
    req.query.status === 'ACTIVE' || req.query.status === 'ARCHIVED'
      ? req.query.status
      : undefined;
  const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined;
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;
  const threads = await smsService.listThreads({ search, status, limit });
  sendSuccess(res, { items: threads });
});

router.get('/threads/lead/:leadId', async (req: Request, res: Response) => {
  const thread = await smsService.getOrCreateThread(req.params.leadId);
  sendSuccess(res, thread);
});

router.get('/threads/:id', async (req: Request, res: Response) => {
  const thread = await smsService.getThreadById(req.params.id);
  sendSuccess(res, thread);
});

router.post('/threads/:id/send', async (req: Request, res: Response) => {
  const { body } = req.body;
  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    res.status(400).json({ success: false, error: 'Message body is required' });
    return;
  }
  const result = await smsService.sendSms(req.params.id, body.trim());
  sendSuccess(res, result);
});

/** Send SMS to a lead by ID (get or create thread). For admin dashboard. */
router.post('/send-to-lead', async (req: Request, res: Response) => {
  const { leadId, body } = req.body;
  if (!leadId || !body || typeof body !== 'string' || body.trim().length === 0) {
    res.status(400).json({ success: false, error: 'leadId and body are required' });
    return;
  }
  const thread = await smsService.getOrCreateThread(leadId);
  const result = await smsService.sendSms(thread.id, body.trim());
  sendSuccess(res, { ...result, threadId: thread.id });
});

/**
 * Twilio webhook stub - implement when Twilio is configured.
 * POST /api/sms/webhook
 * Validates Twilio signature and processes inbound/status callbacks.
 */
// router.post('/webhook', (req: Request, res: Response) => {
//   // const signature = req.headers['x-twilio-signature'];
//   // Validate and process webhook
//   res.status(200).send('<Response></Response>');
// });

export default router;
