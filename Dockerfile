FROM node:24.1.0-alpine AS builder
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:24.1.0-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma

RUN npm ci --omit=dev

EXPOSE 3000
CMD ["/bin/sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
