-- Add login username; make email optional (nullable unique allows multiple NULLs in PostgreSQL).

ALTER TABLE "User" ADD COLUMN "username" TEXT;

UPDATE "User" SET username = lower(split_part(email, '@', 1)) WHERE username IS NULL;

UPDATE "User" SET username = 'user' || substr(id, 1, 12) WHERE username IS NULL OR trim(username) = '';

WITH numbered AS (
  SELECT id, username, ROW_NUMBER() OVER (PARTITION BY username ORDER BY "createdAt") AS rn
  FROM "User"
)
UPDATE "User" u
SET username = u.username || numbered.rn::text
FROM numbered
WHERE u.id = numbered.id AND numbered.rn > 1;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
