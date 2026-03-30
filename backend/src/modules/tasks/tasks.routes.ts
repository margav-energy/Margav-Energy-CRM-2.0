import { Router } from 'express';
import * as tasksController from './tasks.controller';
import { authMiddleware, requireRoles, validate } from '../../middleware';
import {
  taskIdParamSchema,
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  listTasksQuerySchema,
} from './tasks.validation';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES));

router.get(
  '/',
  validate(listTasksQuerySchema, 'query'),
  tasksController.listTasks
);

router.get(
  '/:id',
  validate(taskIdParamSchema, 'params'),
  tasksController.getTaskById
);

router.post(
  '/',
  validate(createTaskSchema, 'body'),
  tasksController.createTask
);

router.patch(
  '/:id',
  validate(taskIdParamSchema, 'params'),
  validate(updateTaskSchema, 'body'),
  tasksController.updateTask
);

router.patch(
  '/:id/status',
  validate(taskIdParamSchema, 'params'),
  validate(updateTaskStatusSchema, 'body'),
  tasksController.updateTaskStatus
);

export default router;
