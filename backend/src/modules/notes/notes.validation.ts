import { z } from 'zod';

const noteEntityTypeEnum = z.enum(['LEAD', 'APPOINTMENT', 'OPPORTUNITY']);

export const noteIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const createNoteSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  entityType: noteEntityTypeEnum,
  leadId: z.string().cuid().optional(),
  appointmentId: z.string().cuid().optional(),
  opportunityId: z.string().cuid().optional(),
}).refine(
  (data) => {
    if (data.entityType === 'LEAD') return !!data.leadId;
    if (data.entityType === 'APPOINTMENT') return !!data.appointmentId;
    if (data.entityType === 'OPPORTUNITY') return !!data.opportunityId;
    return false;
  },
  { message: 'Entity ID must match entity type' }
);

export const listNotesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  entityType: noteEntityTypeEnum.optional(),
  leadId: z.string().cuid().optional(),
  appointmentId: z.string().cuid().optional(),
  opportunityId: z.string().cuid().optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
