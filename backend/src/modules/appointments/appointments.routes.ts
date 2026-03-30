import { Router } from 'express';
import * as appointmentsController from './appointments.controller';
import { authMiddleware, requireRoles, validate } from '../../middleware';
import {
  appointmentIdParamSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
  listAppointmentsQuerySchema,
} from './appointments.validation';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN, Role.QUALIFIER, Role.FIELD_SALES));

router.get(
  '/',
  validate(listAppointmentsQuerySchema, 'query'),
  appointmentsController.listAppointments
);

router.get(
  '/:id',
  validate(appointmentIdParamSchema, 'params'),
  appointmentsController.getAppointmentById
);

router.post(
  '/',
  validate(createAppointmentSchema, 'body'),
  appointmentsController.createAppointment
);

router.patch(
  '/:id',
  validate(appointmentIdParamSchema, 'params'),
  validate(updateAppointmentSchema, 'body'),
  appointmentsController.updateAppointment
);

router.patch(
  '/:id/status',
  validate(appointmentIdParamSchema, 'params'),
  validate(updateAppointmentStatusSchema, 'body'),
  appointmentsController.updateAppointmentStatus
);

export default router;
