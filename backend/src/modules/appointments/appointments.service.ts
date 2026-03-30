import { AppointmentStatus } from '@prisma/client';
import { prisma } from '../../db';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  UpdateAppointmentStatusInput,
  ListAppointmentsQuery,
} from './appointments.validation';

const appointmentInclude = {
  lead: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      addressLine1: true,
      city: true,
      postcode: true,
    },
  },
  fieldSalesRep: { select: { id: true, fullName: true, email: true } },
};

export async function listAppointments(query: ListAppointmentsQuery) {
  const { page, pageSize, leadId, fieldSalesRepId, status, fromDate, toDate } = query;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (leadId) where.leadId = leadId;
  if (fieldSalesRepId) where.fieldSalesRepId = fieldSalesRepId;
  if (status) where.status = status;

  if (fromDate || toDate) {
    where.scheduledAt = {};
    if (fromDate) (where.scheduledAt as Record<string, Date>).gte = new Date(fromDate);
    if (toDate) (where.scheduledAt as Record<string, Date>).lte = new Date(toDate);
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: { scheduledAt: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);

  return { items: appointments, total, page, pageSize };
}

export async function getAppointmentById(id: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: appointmentInclude,
  });

  if (!appointment) {
    throw new AppError('Appointment not found', 404);
  }

  return appointment;
}

export async function createAppointment(input: CreateAppointmentInput) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  const appointment = await prisma.appointment.create({
    data: {
      leadId: input.leadId,
      fieldSalesRepId: input.fieldSalesRepId,
      scheduledAt: new Date(input.scheduledAt),
      notes: input.notes,
      status: AppointmentStatus.SCHEDULED,
    },
    include: appointmentInclude,
  });

  await prisma.lead.update({
    where: { id: input.leadId },
    data: {
      status: 'APPOINTMENT_SET' as const,
      assignedFieldSalesRepId: input.fieldSalesRepId,
    },
  });

  return appointment;
}

export async function updateAppointment(id: string, input: UpdateAppointmentInput) {
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Appointment not found', 404);
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...(input.fieldSalesRepId && { fieldSalesRepId: input.fieldSalesRepId }),
      ...(input.scheduledAt && { scheduledAt: new Date(input.scheduledAt) }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
    include: appointmentInclude,
  });

  return appointment;
}

export async function updateAppointmentStatus(
  id: string,
  input: UpdateAppointmentStatusInput
) {
  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Appointment not found', 404);
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status: input.status as AppointmentStatus },
    include: appointmentInclude,
  });

  return appointment;
}
