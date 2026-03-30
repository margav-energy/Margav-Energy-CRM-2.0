import { z } from 'zod';

export const mergeLeadsSchema = z.object({
  keepLeadId: z.string().cuid(),
  mergeLeadId: z.string().cuid(),
});
