import { Router } from 'express';
import * as adminController from './admin.controller';
import { authMiddleware, requireRoles, validate } from '../../middleware';
import { Role } from '@prisma/client';
import { mergeLeadsSchema } from './admin.validation';
import { leadIdParamSchema } from '../leads/leads.validation';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN));

router.get('/overview/charts', adminController.getOverviewCharts);
router.get('/overview', adminController.getOverview);
router.post('/leads/merge', validate(mergeLeadsSchema, 'body'), adminController.mergeLeads);
router.delete('/leads/:id', validate(leadIdParamSchema, 'params'), adminController.deleteLead);
router.get('/leads', adminController.getLeads);
router.get('/appointments', adminController.getAppointments);
router.get('/opportunities', adminController.getOpportunities);
router.get('/users', adminController.getUsers);
router.get('/sms-metrics', adminController.getSmsMetrics);
router.get('/data-quality', adminController.getDataQuality);
router.get('/audit-log', adminController.getAuditLog);
router.get('/settings-config', adminController.getSettingsConfig);
router.get('/team-workload', adminController.getTeamWorkload);

export default router;
