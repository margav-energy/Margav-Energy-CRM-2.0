import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import * as leadsService from './leads.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';

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

export async function qualifyLead(req: Request, res: Response): Promise<void> {
  const result = await leadsService.qualifyLead(
    req.params.id,
    req.body,
    req.user!.userId
  );
  sendSuccess(res, result);
}
