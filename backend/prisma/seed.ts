import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Password123!';

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@margav.com' },
    update: {},
    create: {
      fullName: 'Admin User',
      email: 'admin@margav.com',
      passwordHash,
      role: 'ADMIN',
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: 'john.doe@margav.com' },
    update: {},
    create: {
      fullName: 'John Doe',
      email: 'john.doe@margav.com',
      passwordHash,
      role: 'AGENT',
    },
  });

  const qualifier = await prisma.user.upsert({
    where: { email: 'kelly@margav.com' },
    update: {},
    create: {
      fullName: 'Kelly Smith',
      email: 'kelly@margav.com',
      passwordHash,
      role: 'QUALIFIER',
    },
  });

  const fieldSales1 = await prisma.user.upsert({
    where: { email: 'mike.rodriguez@margav.com' },
    update: {},
    create: {
      fullName: 'Mike Rodriguez',
      email: 'mike.rodriguez@margav.com',
      passwordHash,
      role: 'FIELD_SALES',
    },
  });

  const fieldSales2 = await prisma.user.upsert({
    where: { email: 'sarah.kim@margav.com' },
    update: {},
    create: {
      fullName: 'Sarah Kim',
      email: 'sarah.kim@margav.com',
      passwordHash,
      role: 'FIELD_SALES',
    },
  });

  console.log('Created users:', {
    admin: admin.email,
    agent: agent.email,
    qualifier: qualifier.email,
    fieldSales: [fieldSales1.email, fieldSales2.email],
  });

  console.log('\nSeed completed. To import your leads dataset:');
  console.log('1. Export your spreadsheet to CSV');
  console.log('2. Save as backend/data/leads_import.csv');
  console.log('3. Run: npm run db:import-leads');
  console.log('\nDefault password for all users:', DEFAULT_PASSWORD);
  console.log('Admin login: admin@margav.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
