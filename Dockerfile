# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci


FROM node:22-bookworm-slim AS builder
ENV NODE_OPTIONS="--max-old-space-size=6144"

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=secret,id=env,target=/app/.env.local \
    npx prisma generate

RUN --mount=type=secret,id=env,target=/app/.env.local \
    npm run build


FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["npm","start"]
