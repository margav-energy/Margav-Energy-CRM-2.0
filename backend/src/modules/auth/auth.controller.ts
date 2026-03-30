import { Request, Response } from 'express';
import * as authService from './auth.service';
import { sendSuccess } from '../../utils/apiResponse';

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body);
  sendSuccess(res, result, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  sendSuccess(res, result);
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await authService.getMe(req.user!.userId);
  sendSuccess(res, user);
}
