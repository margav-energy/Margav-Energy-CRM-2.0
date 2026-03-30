import { Router } from 'express';
import * as leadsController from './leads.controller';
import { authMiddleware, requireRoles, validate, apiKeyAuth } from '../../middleware';
import {
  leadIdParamSchema,
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  listLeadsQuerySchema,
  importLeadSchema,
  qualifyLeadSchema,
} from './leads.validation';
import { Role } from '@prisma/client';

const router = Router();

// Import endpoint - API key auth (for Google Sheets). Must be before authMiddleware
router.post(
  '/import',
  apiKeyAuth,
  validate(importLeadSchema, 'body'),
  leadsController.importLead
);

router.use(authMiddleware);

router.get(
  '/',
  requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES),
  validate(listLeadsQuerySchema, 'query'),
  leadsController.listLeads
);

router.get(
  '/:id',
  requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES),
  validate(leadIdParamSchema, 'params'),
  leadsController.getLeadById
);

router.post(
  '/',
  requireRoles(Role.ADMIN, Role.AGENT),
  validate(createLeadSchema, 'body'),
  leadsController.createLead
);

router.patch(
  '/:id',
  requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES),
  validate(leadIdParamSchema, 'params'),
  validate(updateLeadSchema, 'body'),
  leadsController.updateLead
);

router.patch(
  '/:id/status',
  requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES),
  validate(leadIdParamSchema, 'params'),
  validate(updateLeadStatusSchema, 'body'),
  leadsController.updateLeadStatus
);

router.post(
  '/:id/qualify',
  requireRoles(Role.ADMIN, Role.QUALIFIER),
  validate(leadIdParamSchema, 'params'),
  validate(qualifyLeadSchema, 'body'),
  leadsController.qualifyLead
);

router.get(
  '/:id/history',
  requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES),
  validate(leadIdParamSchema, 'params'),
  leadsController.getLeadHistory
);

router.get(
  '/:id/activity',
  requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES),
  validate(leadIdParamSchema, 'params'),
  leadsController.getLeadActivity
);

export default router;
