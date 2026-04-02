import { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  username?: string;
  email?: string | null;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
