# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build && npm run build:server && mkdir -p /app/data

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5555

COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./
COPY --from=builder /app/data ./data

EXPOSE 5555
CMD ["dist/server.js"]
