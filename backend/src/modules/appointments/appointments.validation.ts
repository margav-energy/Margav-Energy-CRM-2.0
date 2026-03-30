import { z } from 'zod';

const appointmentStatusEnum = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']);

export const appointmentIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const createAppointmentSchema = z.object({
  leadId: z.string().cuid(),
  fieldSalesRepId: z.string().cuid(),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  fieldSalesRepId: z.string().cuid().optional(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: appointmentStatusEnum,
});

export const listAppointmentsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  leadId: z.string().cuid().optional(),
  fieldSalesRepId: z.string().cuid().optional(),
  status: appointmentStatusEnum.optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
