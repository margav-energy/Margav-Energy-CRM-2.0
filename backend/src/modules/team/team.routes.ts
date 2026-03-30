import { Router } from 'express';
import * as teamController from './team.controller';
import { authMiddleware, requireRoles } from '../../middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN, Role.QUALIFIER));

router.get('/field-sales-reps', teamController.getFieldSalesReps);

export default router;
