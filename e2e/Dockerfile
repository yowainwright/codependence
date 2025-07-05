# Multi-stage Dockerfile for testing codependence init functionality
FROM node:24-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY ../package.json ./
COPY ../pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm@10.12.1

# Set environment to disable automatic Node switching
ENV PNPM_NODE_VERSION=24
ENV SKIP_NODE_VERSION_CHECK=1

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY .. .

# Build the project normally
RUN pnpm run build-dist

# Test stage - clean environment for testing
FROM node:24-slim AS test

# Install pnpm globally
RUN npm install -g pnpm@10.12.1

# Create a non-root user for testing
RUN groupadd -g 1001 testuser && \
    useradd -r -u 1001 -g testuser testuser

# Set working directory
WORKDIR /test

# Copy built distribution and necessary files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install only production dependencies (skip prepare scripts)
RUN pnpm install --production --frozen-lockfile --ignore-scripts

# Copy test fixtures
COPY e2e/fixtures/* ./

# Make test script executable
RUN chmod +x test-init.sh

# Change ownership to test user
RUN chown -R testuser:testuser /test

# Switch to test user
USER testuser

# Set default command
CMD ["./test-init.sh"]
