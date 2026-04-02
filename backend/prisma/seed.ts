import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "Password123!";

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@margav.com" },
    update: {
      fullName: "Admin User",
      username: "admin",
      passwordHash,
    },
    create: {
      fullName: "Admin User",
      username: "admin",
      email: "admin@margav.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "john.doe@margav.com" },
    update: {
      fullName: "John Doe",
      username: "john.doe",
      passwordHash,
    },
    create: {
      fullName: "John Doe",
      username: "john.doe",
      email: "john.doe@margav.com",
      passwordHash,
      role: "AGENT",
    },
  });

  const qualifier = await prisma.user.upsert({
    where: { email: "kelly@margav.com" },
    update: {
      fullName: "Kelly Smith",
      username: "kellys",
      passwordHash,
    },
    create: {
      fullName: "Kelly Smith",
      username: "kellys",
      email: "kelly@margav.com",
      passwordHash,
      role: "QUALIFIER",
    },
  });

  const louisPasswordHash = await bcrypt.hash("123456", 12);
  const louisSheetQualifier = await prisma.user.upsert({
    where: { email: "louis@margav.com" },
    update: {
      fullName: "Louis",
      username: "louis",
      passwordHash: louisPasswordHash,
      role: "QUALIFIER",
    },
    create: {
      fullName: "Louis",
      username: "louis",
      email: "louis@margav.com",
      passwordHash: louisPasswordHash,
      role: "QUALIFIER",
    },
  });

  const fieldSales1 = await prisma.user.upsert({
    where: { email: "mike.rodriguez@margav.com" },
    update: {
      fullName: "Mike Rodriguez",
      username: "miker",
      passwordHash,
    },
    create: {
      fullName: "Mike Rodriguez",
      username: "miker",
      email: "mike.rodriguez@margav.com",
      passwordHash,
      role: "FIELD_SALES",
    },
  });

  const fieldSales2 = await prisma.user.upsert({
    where: { email: "sarah.kim@margav.com" },
    update: {
      fullName: "Sarah Kim",
      username: "sarahk",
      passwordHash,
    },
    create: {
      fullName: "Sarah Kim",
      username: "sarahk",
      email: "sarah.kim@margav.com",
      passwordHash,
      role: "FIELD_SALES",
    },
  });

  console.log("Created users:", {
    admin: admin.username,
    agent: agent.username,
    qualifier: qualifier.username,
    sheetQualifier: louisSheetQualifier.username,
    fieldSales: [fieldSales1.username, fieldSales2.username],
  });

  console.log("\nSeed completed. To import your leads dataset:");
  console.log("1. Export your spreadsheet to CSV");
  console.log("2. Save as backend/data/leads_import.csv");
  console.log("3. Run: npm run db:import-leads");
  console.log("\nDefault password for most users:", DEFAULT_PASSWORD);
  console.log("Admin login: username admin");
  console.log(
    "\nLouis (Rattle & Leadwise qualifier): username louis / password 123456",
  );
  console.log(
    "Set SPECIAL_SHEETS_QUALIFIER_USERNAMES=louis in .env for the sheet dashboard.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
