import { z } from 'zod';

const taskTypeEnum = z.enum(['CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'PROPOSAL']);
const taskStatusEnum = z.enum(['PENDING', 'COMPLETED', 'OVERDUE']);
const taskPriorityEnum = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const taskIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  type: taskTypeEnum,
  priority: taskPriorityEnum.default('MEDIUM'),
  dueDate: z.string().datetime(),
  assignedToUserId: z.string().cuid(),
  leadId: z.string().cuid().nullable().optional(),
  opportunityId: z.string().cuid().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  type: taskTypeEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.string().datetime().optional(),
  assignedToUserId: z.string().cuid().optional(),
  leadId: z.string().cuid().nullable().optional(),
  opportunityId: z.string().cuid().nullable().optional(),
});

export const updateTaskStatusSchema = z.object({
  status: taskStatusEnum,
});

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  status: taskStatusEnum.optional(),
  type: taskTypeEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assignedToUserId: z.string().cuid().optional(),
  leadId: z.string().cuid().optional(),
  opportunityId: z.string().cuid().optional(),
  search: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
