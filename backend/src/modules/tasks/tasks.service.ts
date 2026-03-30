import { prisma } from '../../db';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateTaskInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  ListTasksQuery,
} from './tasks.validation';
import { TaskStatus } from '@prisma/client';

const taskInclude = {
  assignedToUser: { select: { id: true, fullName: true, email: true } },
  createdByUser: { select: { id: true, fullName: true, email: true } },
  lead: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
  },
  opportunity: {
    select: {
      id: true,
      stage: true,
      productType: true,
      estimatedValue: true,
    },
  },
};

export async function listTasks(query: ListTasksQuery) {
  const {
    page,
    pageSize,
    status,
    type,
    priority,
    assignedToUserId,
    leadId,
    opportunityId,
    search,
  } = query;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (priority) where.priority = priority;
  if (assignedToUserId) where.assignedToUserId = assignedToUserId;
  if (leadId) where.leadId = leadId;
  if (opportunityId) where.opportunityId = opportunityId;

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' as const } },
      { description: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: pageSize,
    }),
    prisma.task.count({ where }),
  ]);

  return { items: tasks, total, page, pageSize };
}

export async function getTaskById(id: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: taskInclude,
  });

  if (!task) {
    throw new AppError('Task not found', 404);
  }

  return task;
}

export async function createTask(input: CreateTaskInput, createdByUserId: string) {
  const task = await prisma.task.create({
    data: {
      ...input,
      dueDate: new Date(input.dueDate),
      createdByUserId,
      leadId: input.leadId ?? undefined,
      opportunityId: input.opportunityId ?? undefined,
    },
    include: taskInclude,
  });

  return task;
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Task not found', 404);
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(input.title && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.type && { type: input.type }),
      ...(input.priority && { priority: input.priority }),
      ...(input.dueDate && { dueDate: new Date(input.dueDate) }),
      ...(input.assignedToUserId && { assignedToUserId: input.assignedToUserId }),
      ...(input.leadId !== undefined && { leadId: input.leadId }),
      ...(input.opportunityId !== undefined && { opportunityId: input.opportunityId }),
    },
    include: taskInclude,
  });

  return task;
}

export async function updateTaskStatus(id: string, input: UpdateTaskStatusInput) {
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Task not found', 404);
  }

  const task = await prisma.task.update({
    where: { id },
    data: { status: input.status as TaskStatus },
    include: taskInclude,
  });

  return task;
}
