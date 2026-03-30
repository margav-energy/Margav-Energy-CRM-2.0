import { Router } from 'express';
import * as reportsController from './reports.controller';
import { authMiddleware, requireRoles } from '../../middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES));

router.get('/funnel', reportsController.getFunnel);
router.get('/product-mix', reportsController.getProductMix);
router.get('/monthly-trends', reportsController.getMonthlyTrends);
router.get('/rep-performance', reportsController.getRepPerformance);
router.get('/weekly-lead-performance', reportsController.getWeeklyLeadPerformance);
router.get('/weekly-funnel', reportsController.getWeeklyFunnel);
router.get('/appointment-outcomes', reportsController.getAppointmentOutcomes);

// Agent-specific reports (filter by assignedAgentId)
router.get('/agent/depositions', requireRoles(Role.AGENT), reportsController.getAgentDepositions);
router.get('/agent/outcomes', requireRoles(Role.AGENT), reportsController.getAgentOutcomes);
router.get('/agent/summary', requireRoles(Role.AGENT), reportsController.getAgentSummary);

export default router;
