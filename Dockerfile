# Multi-stage build for React client + Node.js server
FROM node:18-alpine AS deps

# Install dependencies for faster builds
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY client/package*.json ./client/

# Install all dependencies in parallel
RUN npm ci --only=production && \
    cd client && npm ci --only=production

# Client builder stage
FROM node:18-alpine AS client-builder

WORKDIR /app/client

# Copy dependencies from deps stage
COPY --from=deps /app/client/node_modules ./node_modules

# Copy source code
COPY client/ ./

# Build with optimizations
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install only runtime dependencies
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package.json for npm scripts
COPY package.json ./

# Copy server source
COPY server/ ./server/

# Copy built client
COPY --from=client-builder /app/client/build ./public

# Set production environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start with dumb-init for better signal handling
CMD ["dumb-init", "npm", "start"]
