# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable \
  && corepack prepare pnpm@9.12.3 --activate \
  && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV POSTGRES_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV SCALEWAY_OS_ACCESS_KEY_ID=placeholder
ENV SCALEWAY_OS_SECRET_ACCESS_KEY=placeholder
ENV SCALEWAY_OS_BUCKET_NAME=placeholder
ENV AUTH_SECRET=placeholder-secret-for-build-only
ENV BERGET_AI_API_KEY=placeholder
ENV NEXT_PUBLIC_APP_URL=http://localhost:8080

# Build the application (skip migrations during build)
RUN corepack enable \
  && corepack prepare pnpm@9.12.3 --activate \
  && pnpm run build:docker

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy startup script
COPY --from=builder --chown=nextjs:nodejs /app/start.sh ./

# Make startup script executable
RUN chmod +x start.sh

USER nextjs

# Serverless Containers expects port 8080
EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["./start.sh"] 
