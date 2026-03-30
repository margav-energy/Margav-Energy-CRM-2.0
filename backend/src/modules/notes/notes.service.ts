import { NoteEntityType } from '@prisma/client';
import { prisma } from '../../db';
import { AppError } from '../../middleware/errorHandler';
import { CreateNoteInput, ListNotesQuery } from './notes.validation';

const noteInclude = {
  createdByUser: { select: { id: true, fullName: true, email: true } },
  lead: { select: { id: true, firstName: true, lastName: true } },
  appointment: { select: { id: true, scheduledAt: true } },
  opportunity: { select: { id: true, stage: true } },
};

export async function listNotes(query: ListNotesQuery) {
  const { page, pageSize, entityType, leadId, appointmentId, opportunityId } = query;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (entityType) where.entityType = entityType;
  if (leadId) where.leadId = leadId;
  if (appointmentId) where.appointmentId = appointmentId;
  if (opportunityId) where.opportunityId = opportunityId;

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      include: noteInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.note.count({ where }),
  ]);

  return { items: notes, total, page, pageSize };
}

export async function getNoteById(id: string) {
  const note = await prisma.note.findUnique({
    where: { id },
    include: noteInclude,
  });

  if (!note) {
    throw new AppError('Note not found', 404);
  }

  return note;
}

export async function createNote(input: CreateNoteInput, createdByUserId: string) {
  const data: {
    content: string;
    entityType: NoteEntityType;
    createdByUserId: string;
    leadId?: string;
    appointmentId?: string;
    opportunityId?: string;
  } = {
    content: input.content,
    entityType: input.entityType as NoteEntityType,
    createdByUserId,
  };

  if (input.entityType === 'LEAD' && input.leadId) data.leadId = input.leadId;
  if (input.entityType === 'APPOINTMENT' && input.appointmentId)
    data.appointmentId = input.appointmentId;
  if (input.entityType === 'OPPORTUNITY' && input.opportunityId)
    data.opportunityId = input.opportunityId;

  const note = await prisma.note.create({
    data,
    include: noteInclude,
  });

  return note;
}
