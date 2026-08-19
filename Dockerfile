# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy root and workspace files
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm install

# Copy application code
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Test stage
FROM builder AS test

WORKDIR /app

RUN npm run test:api

# Production stage
FROM node:24-alpine

WORKDIR /app

# Copy from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages
COPY package*.json ./

EXPOSE 3000

CMD ["npm", "run", "dev:api"]
