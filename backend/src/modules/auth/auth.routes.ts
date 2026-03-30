import { Router } from 'express';
import * as authController from './auth.controller';
import { validate, authMiddleware } from '../../middleware';
import { registerSchema, loginSchema } from './auth.validation';

const router = Router();

router.post('/register', validate(registerSchema, 'body'), authController.register);
router.post('/login', validate(loginSchema, 'body'), authController.login);
router.get('/me', authMiddleware, authController.getMe);

export default router;
