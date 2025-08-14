# Multi-stage build for React client + Node.js server
FROM node:18-alpine AS client-builder

# Set working directory
WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm ci --only=production

# Copy client source code
COPY client/ ./

# Build the React app
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including client dependencies)
RUN npm ci --only=production
RUN cd client && npm ci --only=production && cd ..

# Copy source code
COPY server/ ./server/
COPY client/ ./client/

# Copy built client from builder stage
COPY --from=client-builder /app/client/build ./public

# Set production environment
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["npm", "start"]
