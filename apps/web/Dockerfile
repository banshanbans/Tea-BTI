FROM node:22-alpine AS base
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci

FROM base AS development
COPY apps/web apps/web
COPY packages/contracts packages/contracts
EXPOSE 3000
CMD ["npm", "--workspace", "apps/web", "run", "dev"]

FROM base AS builder
COPY apps/web apps/web
COPY packages/contracts packages/contracts
RUN npm --workspace apps/web run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]