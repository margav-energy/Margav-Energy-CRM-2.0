import { Router } from 'express';
import * as usersController from './users.controller';
import { authMiddleware, requireRoles, validate } from '../../middleware';
import {
  userIdParamSchema,
  createUserSchema,
  updateUserSchema,
  listUsersQuerySchema,
} from './users.validation';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN));

router.post('/', validate(createUserSchema, 'body'), usersController.createUser);
router.get('/', validate(listUsersQuerySchema, 'query'), usersController.listUsers);
router.get('/:id', validate(userIdParamSchema, 'params'), usersController.getUserById);
router.patch(
  '/:id',
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema, 'body'),
  usersController.updateUser
);

export default router;
