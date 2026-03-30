import { Router } from 'express';
import * as notesController from './notes.controller';
import { authMiddleware, requireRoles, validate } from '../../middleware';
import {
  noteIdParamSchema,
  createNoteSchema,
  listNotesQuerySchema,
} from './notes.validation';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);
router.use(requireRoles(Role.ADMIN, Role.AGENT, Role.QUALIFIER, Role.FIELD_SALES));

router.post(
  '/',
  validate(createNoteSchema, 'body'),
  notesController.createNote
);

router.get(
  '/',
  validate(listNotesQuerySchema, 'query'),
  notesController.listNotes
);

router.get(
  '/:id',
  validate(noteIdParamSchema, 'params'),
  notesController.getNoteById
);

export default router;
