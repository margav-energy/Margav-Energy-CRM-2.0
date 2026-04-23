import { Request, Response } from 'express';
import * as reportsService from './reports.service';
import { sendSuccess } from '../../utils/apiResponse';

export async function getFunnel(req: Request, res: Response): Promise<void> {
  const months = (req.query.months as string) ? parseInt(req.query.months as string, 10) : 6;
  const data = await reportsService.getFunnelReport(months, { userId: req.user!.userId, role: req.user!.role });
  sendSuccess(res, data);
}

export async function getProductMix(req: Request, res: Response): Promise<void> {
  const months = (req.query.months as string) ? parseInt(req.query.months as string, 10) : 6;
  const data = await reportsService.getProductMixReport(months, { userId: req.user!.userId, role: req.user!.role });
  sendSuccess(res, data);
}

export async function getMonthlyTrends(req: Request, res: Response): Promise<void> {
  const months = (req.query.months as string) ? parseInt(req.query.months as string, 10) : 6;
  const data = await reportsService.getMonthlyTrendsReport(months, { userId: req.user!.userId, role: req.user!.role });
  sendSuccess(res, data);
}

export async function getRepPerformance(req: Request, res: Response): Promise<void> {
  const months = (req.query.months as string) ? parseInt(req.query.months as string, 10) : 6;
  const data = await reportsService.getRepPerformanceReport(months, {
    userId: req.user!.userId,
    role: req.user!.role,
  });
  sendSuccess(res, data);
}

export async function getWeeklyLeadPerformance(req: Request, res: Response): Promise<void> {
  const weeks = (req.query.weeks as string) ? parseInt(req.query.weeks as string, 10) : 1;
  const data = await reportsService.getWeeklyLeadPerformanceReport(weeks, { userId: req.user!.userId, role: req.user!.role });
  sendSuccess(res, data);
}

export async function getWeeklyFunnel(req: Request, res: Response): Promise<void> {
  const weeks = (req.query.weeks as string) ? parseInt(req.query.weeks as string, 10) : 1;
  const data = await reportsService.getWeeklyFunnelReport(weeks, { userId: req.user!.userId, role: req.user!.role });
  sendSuccess(res, data);
}

export async function getAppointmentOutcomes(req: Request, res: Response): Promise<void> {
  const weeks = (req.query.weeks as string) ? parseInt(req.query.weeks as string, 10) : 4;
  const data = await reportsService.getAppointmentOutcomesReport(weeks, { userId: req.user!.userId, role: req.user!.role });
  sendSuccess(res, data);
}

/** Solar vs heating (boilers) lead mix — `weeks` or `months` query (weeks wins if both sent) */
export async function getLeadProductLines(req: Request, res: Response): Promise<void> {
  const weeksRaw = req.query.weeks as string | undefined;
  const monthsRaw = req.query.months as string | undefined;
  const weeks = weeksRaw ? parseInt(weeksRaw, 10) : undefined;
  const months = monthsRaw ? parseInt(monthsRaw, 10) : 6;
  const data = await reportsService.getLeadProductLineReport(
    { userId: req.user!.userId, role: req.user!.role },
    weeks != null && !Number.isNaN(weeks) ? { weeks } : { months }
  );
  sendSuccess(res, data);
}

export async function getAgentDepositions(req: Request, res: Response): Promise<void> {
  const weeks = (req.query.weeks as string) ? parseInt(req.query.weeks as string, 10) : 4;
  const agentId = req.user!.userId;
  const data = await reportsService.getAgentDepositionsReport(agentId, weeks);
  sendSuccess(res, data);
}

export async function getAgentOutcomes(req: Request, res: Response): Promise<void> {
  const weeks = (req.query.weeks as string) ? parseInt(req.query.weeks as string, 10) : 4;
  const agentId = req.user!.userId;
  const data = await reportsService.getAgentOutcomesReport(agentId, weeks);
  sendSuccess(res, data);
}

export async function getAgentSummary(req: Request, res: Response): Promise<void> {
  const weeks = (req.query.weeks as string) ? parseInt(req.query.weeks as string, 10) : 4;
  const agentId = req.user!.userId;
  const data = await reportsService.getAgentSummaryReport(agentId, weeks);
  sendSuccess(res, data);
}
