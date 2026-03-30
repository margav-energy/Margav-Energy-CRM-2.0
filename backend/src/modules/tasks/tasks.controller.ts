import { Request, Response } from 'express';
import * as tasksService from './tasks.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';

export async function listTasks(req: Request, res: Response): Promise<void> {
  const result = await tasksService.listTasks(req.query as never);
  sendPaginated(res, result.items, result.total, result.page, result.pageSize);
}

export async function getTaskById(req: Request, res: Response): Promise<void> {
  const task = await tasksService.getTaskById(req.params.id);
  sendSuccess(res, task);
}

export async function createTask(req: Request, res: Response): Promise<void> {
  const task = await tasksService.createTask(req.body, req.user!.userId);
  sendSuccess(res, task, 201);
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const task = await tasksService.updateTask(req.params.id, req.body);
  sendSuccess(res, task);
}

export async function updateTaskStatus(req: Request, res: Response): Promise<void> {
  const task = await tasksService.updateTaskStatus(req.params.id, req.body);
  sendSuccess(res, task);
}
