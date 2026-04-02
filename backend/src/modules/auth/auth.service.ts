import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { RegisterInput, LoginInput } from './auth.validation';
import { Role } from '@prisma/client';
import { isSpecialSheetsQualifier } from '../leads/googleSheetsSync.service';
import { allocateUsername, displayUsernameFromFullName } from '../../utils/username';

function userResponse(user: {
  id: string;
  fullName: string;
  username: string;
  email: string | null;
  role: Role;
  createdAt: Date;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    usernameDisplay: displayUsernameFromFullName(user.fullName),
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    specialSheetQualifier: user.role === Role.QUALIFIER && isSpecialSheetsQualifier(user),
  };
}

export async function register(input: RegisterInput) {
  const email = input.email?.trim().toLowerCase();
  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new AppError('Email already registered', 409);
    }
  }

  const fullName = `${input.firstName} ${input.lastName}`.trim();
  const username = await allocateUsername(input.firstName, input.lastName);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const role = (input.role as Role) || Role.AGENT;

  const user = await prisma.user.create({
    data: {
      fullName,
      username,
      email: email ?? null,
      passwordHash,
      role,
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: 60 * 60 * 24 * 7 }
  );

  return { user: userResponse(user), token };
}

export async function login(input: LoginInput) {
  const canonical = input.username.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { username: canonical },
  });

  if (!user) {
    throw new AppError('Invalid username or password', 401);
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid username or password', 401);
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: 60 * 60 * 24 * 7 }
  );

  return {
    user: userResponse(user),
    token,
  };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return userResponse(user);
}
