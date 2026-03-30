import { Router } from 'express';
import * as notificationsController from './notifications.controller';
import { authMiddleware, requireRoles } from '../../middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES));

router.get('/', notificationsController.getNotifications);

export default router;
