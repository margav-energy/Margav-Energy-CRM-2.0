import { Request, Response } from 'express';
import * as appointmentsService from './appointments.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';

export async function listAppointments(req: Request, res: Response): Promise<void> {
  const result = await appointmentsService.listAppointments(req.query as never);
  sendPaginated(res, result.items, result.total, result.page, result.pageSize);
}

export async function getAppointmentById(req: Request, res: Response): Promise<void> {
  const appointment = await appointmentsService.getAppointmentById(req.params.id);
  sendSuccess(res, appointment);
}

export async function createAppointment(req: Request, res: Response): Promise<void> {
  const result = await appointmentsService.createAppointment(req.body);
  sendSuccess(res, { ...result.appointment, calendarSynced: result.calendarSynced }, 201);
}

export async function updateAppointment(req: Request, res: Response): Promise<void> {
  const appointment = await appointmentsService.updateAppointment(
    req.params.id,
    req.body
  );
  sendSuccess(res, appointment);
}

export async function updateAppointmentStatus(
  req: Request,
  res: Response
): Promise<void> {
  const appointment = await appointmentsService.updateAppointmentStatus(
    req.params.id,
    req.body
  );
  sendSuccess(res, appointment);
}
