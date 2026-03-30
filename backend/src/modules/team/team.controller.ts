import { Request, Response } from 'express';
import * as teamService from './team.service';
import { sendSuccess } from '../../utils/apiResponse';

export async function getFieldSalesReps(req: Request, res: Response) {
  const reps = await teamService.getFieldSalesReps();
  sendSuccess(res, reps);
}
