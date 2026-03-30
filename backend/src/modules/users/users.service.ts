import bcrypt from 'bcrypt';
import { prisma } from '../../db';
import { AppError } from '../../middleware/errorHandler';
import { CreateUserInput, UpdateUserInput, ListUsersQuery } from './users.validation';

const userSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

export async function listUsers(query: ListUsersQuery) {
  const { page, pageSize, role, search } = query;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items: users, total, page, pageSize };
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existing) {
    throw new AppError('Email already registered', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
    },
    select: userSelect,
  });
  return user;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('User not found', 404);
  }

  const data: Record<string, unknown> = {};

  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.email !== undefined) {
    const duplicate = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase(), NOT: { id } },
    });
    if (duplicate) throw new AppError('Email already in use', 409);
    data.email = input.email.toLowerCase();
  }
  if (input.role !== undefined) data.role = input.role;
  if (input.password !== undefined) {
    data.passwordHash = await bcrypt.hash(input.password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  return user;
}
