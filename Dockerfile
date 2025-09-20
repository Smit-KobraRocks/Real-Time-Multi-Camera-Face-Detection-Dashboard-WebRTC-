# syntax=docker/dockerfile:1
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./

RUN npm install

COPY prisma ./prisma
COPY tsconfig.server.json ./
COPY tsconfig.node.json ./
COPY src/server ./src/server

RUN npm run prisma:generate
RUN npm run backend:build
RUN npm prune --production

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/server ./dist/server
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
