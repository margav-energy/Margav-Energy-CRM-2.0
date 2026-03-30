FROM node:20-alpine AS builder

# Prisma on Alpine needs OpenSSL (avoids generate/runtime SSL issues)
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

# Apply SQL migrations then start API (prefer migrate deploy over db push in production)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
