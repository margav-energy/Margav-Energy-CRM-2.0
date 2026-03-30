import { z } from 'zod';

export const reportsQuerySchema = z.object({
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  months: z.coerce.number().min(1).max(24).default(6),
});

export type ReportsQuery = z.infer<typeof reportsQuerySchema>;
