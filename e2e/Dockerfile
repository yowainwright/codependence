# Multi-stage Dockerfile for testing codependence init functionality
FROM node:24-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY ../package.json ./
COPY ../bun.lock ./
COPY ../bunfig.toml ./

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY .. .

# Build the project normally
RUN bun run build-dist

# Test stage - clean environment for testing
FROM node:24-slim AS test

# Install bun globally
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Create a non-root user for testing
RUN groupadd -g 1001 testuser && \
    useradd -r -u 1001 -g testuser testuser

# Set working directory
WORKDIR /test

# Copy built distribution and necessary files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/bunfig.toml ./bunfig.toml

# Install only production dependencies (skip prepare scripts)
RUN bun install --production --frozen-lockfile

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
