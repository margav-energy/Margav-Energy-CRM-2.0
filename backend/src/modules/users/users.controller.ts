import { Request, Response } from 'express';
import * as usersService from './users.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';

export async function createUser(req: Request, res: Response): Promise<void> {
  const user = await usersService.createUser(req.body);
  sendSuccess(res, user, 201);
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const result = await usersService.listUsers(req.query as never);
  sendPaginated(res, result.items, result.total, result.page, result.pageSize);
}

export async function getUserById(req: Request, res: Response): Promise<void> {
  const user = await usersService.getUserById(req.params.id);
  sendSuccess(res, user);
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const user = await usersService.updateUser(req.params.id, req.body);
  sendSuccess(res, user);
}
