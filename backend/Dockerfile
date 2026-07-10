FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy schema first for Prisma generation
COPY src/prisma/schema.prisma ./prisma/schema.prisma
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY src/prisma/schema.prisma ./prisma/schema.prisma

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
