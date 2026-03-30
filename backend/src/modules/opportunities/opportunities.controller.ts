import { Request, Response } from 'express';
import * as opportunitiesService from './opportunities.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';

export async function listOpportunities(req: Request, res: Response): Promise<void> {
  const result = await opportunitiesService.listOpportunities(req.query as never);
  sendPaginated(res, result.items, result.total, result.page, result.pageSize);
}

export async function getOpportunityById(req: Request, res: Response): Promise<void> {
  const opportunity = await opportunitiesService.getOpportunityById(req.params.id);
  sendSuccess(res, opportunity);
}

export async function createOpportunity(req: Request, res: Response): Promise<void> {
  const opportunity = await opportunitiesService.createOpportunity(req.body);
  sendSuccess(res, opportunity, 201);
}

export async function updateOpportunity(req: Request, res: Response): Promise<void> {
  const opportunity = await opportunitiesService.updateOpportunity(
    req.params.id,
    req.body
  );
  sendSuccess(res, opportunity);
}
