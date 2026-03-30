import { Request, Response } from 'express';
import * as adminService from './admin.service';
import { sendSuccess } from '../../utils/apiResponse';

export async function getOverview(req: Request, res: Response) {
  const data = await adminService.getAdminOverview();
  sendSuccess(res, data);
}

export async function getOverviewCharts(req: Request, res: Response) {
  const p = (req.query.period as string) || 'month';
  const period = (['week', 'month', 'quarter'].includes(p) ? p : 'month') as 'week' | 'month' | 'quarter';
  const data = await adminService.getAdminOverviewCharts(period);
  sendSuccess(res, data);
}

export async function mergeLeads(req: Request, res: Response) {
  const { keepLeadId, mergeLeadId } = req.body as { keepLeadId: string; mergeLeadId: string };
  const result = await adminService.mergeLeads(keepLeadId, mergeLeadId);
  sendSuccess(res, result);
}

export async function deleteLead(req: Request, res: Response) {
  await adminService.deleteLead(req.params.id);
  sendSuccess(res, { deleted: true });
}

function firstQueryString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === null ? undefined : String(s);
}

function parsePage(v: unknown): number {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parsePageSize(v: unknown): number {
  const n = parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(100, n);
}

function parseAppointmentPageSize(v: unknown): number {
  const n = parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(500, n);
}

export async function getLeads(req: Request, res: Response) {
  const { view, search, status, source, page, pageSize } = req.query;
  const result = await adminService.getAdminLeads({
    view: firstQueryString(view),
    search: firstQueryString(search),
    status: firstQueryString(status),
    source: firstQueryString(source),
    page: parsePage(page),
    pageSize: parsePageSize(pageSize),
  });
  sendSuccess(res, result);
}

export async function getAppointments(req: Request, res: Response) {
  const { status, page, pageSize, from, to } = req.query;
  const result = await adminService.getAdminAppointments({
    status: firstQueryString(status),
    page: parsePage(page),
    pageSize: parseAppointmentPageSize(pageSize),
    from: firstQueryString(from),
    to: firstQueryString(to),
  });
  sendSuccess(res, result);
}

export async function getOpportunities(req: Request, res: Response) {
  const { stage, page, pageSize } = req.query;
  const result = await adminService.getAdminOpportunities({
    stage: stage as string,
    page: page ? parseInt(String(page), 10) : 1,
    pageSize: pageSize ? parseInt(String(pageSize), 10) : 50,
  });
  sendSuccess(res, result);
}

export async function getUsers(req: Request, res: Response) {
  const data = await adminService.getAdminUsers();
  sendSuccess(res, data);
}

export async function getSmsMetrics(req: Request, res: Response) {
  const data = await adminService.getSmsMetrics();
  sendSuccess(res, data);
}

export async function getDataQuality(req: Request, res: Response) {
  const data = await adminService.getDataQualityIssues();
  sendSuccess(res, data);
}

export async function getAuditLog(req: Request, res: Response) {
  const { page, pageSize, userId } = req.query;
  const data = await adminService.getAdminAuditLog({
    page: page ? parseInt(String(page), 10) : 1,
    pageSize: pageSize ? parseInt(String(pageSize), 10) : 25,
    userId: userId ? String(userId) : undefined,
  });
  sendSuccess(res, data);
}

export async function getSettingsConfig(req: Request, res: Response) {
  const data = adminService.getAdminSettingsConfig();
  sendSuccess(res, data);
}

export async function getTeamWorkload(req: Request, res: Response) {
  const period = (req.query.period as string) || 'month';
  const p = ['week', 'month', 'quarter'].includes(period)
    ? (period as 'week' | 'month' | 'quarter')
    : 'month';
  const data = await adminService.getTeamWorkload(p);
  sendSuccess(res, data);
}
