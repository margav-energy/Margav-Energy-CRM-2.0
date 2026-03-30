import { Router } from 'express';
import * as opportunitiesController from './opportunities.controller';
import { authMiddleware, requireRoles, validate } from '../../middleware';
import {
  opportunityIdParamSchema,
  createOpportunitySchema,
  updateOpportunitySchema,
  listOpportunitiesQuerySchema,
} from './opportunities.validation';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN, Role.FIELD_SALES));

router.get(
  '/',
  validate(listOpportunitiesQuerySchema, 'query'),
  opportunitiesController.listOpportunities
);

router.get(
  '/:id',
  validate(opportunityIdParamSchema, 'params'),
  opportunitiesController.getOpportunityById
);

router.post(
  '/',
  validate(createOpportunitySchema, 'body'),
  opportunitiesController.createOpportunity
);

router.patch(
  '/:id',
  validate(opportunityIdParamSchema, 'params'),
  validate(updateOpportunitySchema, 'body'),
  opportunitiesController.updateOpportunity
);

export default router;
