import { z } from 'zod';

const opportunityStageEnum = z.enum([
  'PITCH_SCHEDULED',
  'PITCH_COMPLETED',
  'WON',
  'LOST',
]);

const productTypeEnum = z.enum(['SOLAR', 'BATTERY', 'EV_CHARGER', 'BUNDLE']);

export const opportunityIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const createOpportunitySchema = z.object({
  leadId: z.string().cuid(),
  ownerId: z.string().cuid(),
  productType: productTypeEnum,
  estimatedValue: z.number().min(0),
  notes: z.string().optional(),
});

export const updateOpportunitySchema = z.object({
  ownerId: z.string().cuid().optional(),
  stage: opportunityStageEnum.optional(),
  productType: productTypeEnum.optional(),
  estimatedValue: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const listOpportunitiesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  leadId: z.string().cuid().optional(),
  ownerId: z.string().cuid().optional(),
  stage: opportunityStageEnum.optional(),
  productType: productTypeEnum.optional(),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
export type ListOpportunitiesQuery = z.infer<typeof listOpportunitiesQuerySchema>;
