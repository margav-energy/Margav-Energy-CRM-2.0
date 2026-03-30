import { prisma } from '../../db';
import { Role } from '@prisma/client';

export async function getFieldSalesReps() {
  const users = await prisma.user.findMany({
    where: { role: Role.FIELD_SALES },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: 'asc' },
  });
  return users;
}
