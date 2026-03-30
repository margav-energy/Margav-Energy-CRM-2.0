import { Request, Response } from 'express';
import * as notesService from './notes.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';

export async function listNotes(req: Request, res: Response): Promise<void> {
  const result = await notesService.listNotes(req.query as never);
  sendPaginated(res, result.items, result.total, result.page, result.pageSize);
}

export async function getNoteById(req: Request, res: Response): Promise<void> {
  const note = await notesService.getNoteById(req.params.id);
  sendSuccess(res, note);
}

export async function createNote(req: Request, res: Response): Promise<void> {
  const note = await notesService.createNote(req.body, req.user!.userId);
  sendSuccess(res, note, 201);
}
