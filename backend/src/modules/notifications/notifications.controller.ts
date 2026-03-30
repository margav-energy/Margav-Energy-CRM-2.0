import { Request, Response } from 'express';
import * as notificationsService from './notifications.service';
import { sendSuccess } from '../../utils/apiResponse';

export async function getNotifications(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const userRole = req.user!.role as 'ADMIN' | 'AGENT' | 'QUALIFIER' | 'FIELD_SALES';
  const data = await notificationsService.getNotificationsForUser(userId, userRole);
  sendSuccess(res, data);
}
