# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install CA certificates and update certificate store
RUN apk add --no-cache ca-certificates && update-ca-certificates

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install CA certificates, curl, openssl, and update certificate store
# This ensures proper SSL/TLS support and provides debugging tools
RUN apk add --no-cache \
    ca-certificates \
    curl \
    openssl \
    && update-ca-certificates

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

# Set Node.js to use system CA certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

USER nodejs

# Expose port (default 3000, can be overridden via PORT env var)
EXPOSE 3000
# Start the server
CMD ["node", "dist/index.js"]

