import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import * as leadsService from './leads.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';
import { prisma } from '../../db';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { syncGoogleSheetsToLeads, isSpecialSheetsQualifier } from './googleSheetsSync.service';

export async function listLeads(req: Request, res: Response): Promise<void> {
  const result = await leadsService.listLeads(
    req.query as never,
    req.user!.userId,
    req.user!.role
  );
  sendPaginated(res, result.items, result.total, result.page, result.pageSize);
}

export async function getLeadById(req: Request, res: Response): Promise<void> {
  const lead = await leadsService.getLeadById(
    req.params.id,
    req.user?.userId,
    req.user?.role
  );
  sendSuccess(res, lead);
}

export async function createLead(req: Request, res: Response): Promise<void> {
  const lead = await leadsService.createLead(req.body, req.user!.userId);
  sendSuccess(res, lead, 201);
}

export async function updateLead(req: Request, res: Response): Promise<void> {
  const body = { ...(req.body as Record<string, unknown>) };
  if (req.user?.role !== Role.ADMIN) {
    delete body.smsAutomationPaused;
    delete body.priority;
    delete body.duplicateOfLeadId;
  }
  const lead = await leadsService.updateLead(
    req.params.id,
    body as never,
    req.user?.userId,
    req.user?.role
  );
  sendSuccess(res, lead);
}

export async function updateLeadStatus(req: Request, res: Response): Promise<void> {
  const lead = await leadsService.updateLeadStatus(
    req.params.id,
    req.body,
    req.user!.userId,
    req.user?.role
  );
  sendSuccess(res, lead);
}

export async function getLeadHistory(req: Request, res: Response): Promise<void> {
  const history = await leadsService.getLeadHistory(req.params.id);
  sendSuccess(res, history);
}

export async function getLeadActivity(req: Request, res: Response): Promise<void> {
  const activity = await leadsService.getLeadActivity(req.params.id);
  sendSuccess(res, activity);
}

export async function importLead(req: Request, res: Response): Promise<void> {
  const lead = await leadsService.importLead(req.body);
  sendSuccess(res, lead, 201);
}

/** Pull Rattle + Leadwise Google Sheets into CRM (special qualifier or admin). */
export async function syncSheetsFromGoogle(req: Request, res: Response): Promise<void> {
  let qualifierId = req.user!.userId;

  if (req.user!.role === Role.ADMIN) {
    const or: Array<{ username?: { in: string[] }; email?: { in: string[] } }> = [];
    if (config.specialSheetsQualifierUsernames.length) {
      or.push({ username: { in: config.specialSheetsQualifierUsernames } });
    }
    if (config.specialSheetsQualifierEmails.length) {
      or.push({ email: { in: config.specialSheetsQualifierEmails } });
    }
    if (!or.length) {
      throw new AppError(
        'Set SPECIAL_SHEETS_QUALIFIER_USERNAMES and/or SPECIAL_SHEETS_QUALIFIER_EMAILS',
        400
      );
    }
    const user = await prisma.user.findFirst({
      where: { role: Role.QUALIFIER, OR: or },
    });
    if (!user) {
      throw new AppError('No QUALIFIER user found for sheet sync env configuration', 400);
    }
    qualifierId = user.id;
  } else if (req.user!.role === Role.QUALIFIER) {
    const u = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { username: true, email: true },
    });
    if (!u || !isSpecialSheetsQualifier(u)) {
      throw new AppError('Forbidden', 403);
    }
  } else {
    throw new AppError('Forbidden', 403);
  }

  const result = await syncGoogleSheetsToLeads(qualifierId);
  sendSuccess(res, result);
}

export async function qualifyLead(req: Request, res: Response): Promise<void> {
  const result = await leadsService.qualifyLead(
    req.params.id,
    req.body,
    req.user!.userId
  );
  sendSuccess(res, result);
}
