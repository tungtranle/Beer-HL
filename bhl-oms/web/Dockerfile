# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Microsoft Clarity — baked in at build time
ARG NEXT_PUBLIC_CLARITY_ID=wgqlli4s7j
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ARG INTERNAL_API_ORIGIN=http://localhost:8080
ARG INTERNAL_OSRM_ORIGIN=http://localhost:5000
ENV NEXT_PUBLIC_CLARITY_ID=$NEXT_PUBLIC_CLARITY_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV INTERNAL_API_ORIGIN=$INTERNAL_API_ORIGIN
ENV INTERNAL_OSRM_ORIGIN=$INTERNAL_OSRM_ORIGIN
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
