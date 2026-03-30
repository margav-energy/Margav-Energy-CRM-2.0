import { prisma } from '../../db';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateOpportunityInput,
  UpdateOpportunityInput,
  ListOpportunitiesQuery,
} from './opportunities.validation';

const opportunityInclude = {
  lead: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      postcode: true,
    },
  },
  owner: { select: { id: true, fullName: true, email: true } },
};

export async function listOpportunities(query: ListOpportunitiesQuery) {
  const { page, pageSize, leadId, ownerId, stage, productType } = query;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (leadId) where.leadId = leadId;
  if (ownerId) where.ownerId = ownerId;
  if (stage) where.stage = stage;
  if (productType) where.productType = productType;

  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      include: opportunityInclude,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return { items: opportunities, total, page, pageSize };
}

export async function getOpportunityById(id: string) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id },
    include: opportunityInclude,
  });

  if (!opportunity) {
    throw new AppError('Opportunity not found', 404);
  }

  return opportunity;
}

export async function createOpportunity(input: CreateOpportunityInput) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      ...input,
      stage: 'PITCH_SCHEDULED',
    },
    include: opportunityInclude,
  });

  return opportunity;
}

export async function updateOpportunity(id: string, input: UpdateOpportunityInput) {
  const existing = await prisma.opportunity.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Opportunity not found', 404);
  }

  const opportunity = await prisma.opportunity.update({
    where: { id },
    data: input,
    include: opportunityInclude,
  });

  return opportunity;
}
