# Multi-stage Dockerfile for testing codependence init functionality
FROM node:24-slim AS builder

# Install curl, unzip and other necessary tools
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY bun.lock ./
COPY bunfig.toml ./

# Copy workspace directories (needed for bun install with workspaces)
COPY page/ ./page/

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Install dependencies (skip git hooks setup in Docker)
RUN bun install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build the project normally
RUN bun run build-dist

# Test stage - clean environment for testing
FROM node:24-slim AS test

# Install curl, unzip and other necessary tools
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

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
COPY --from=builder /app/page ./page

# Install only production dependencies (skip prepare scripts)
RUN bun install --production --frozen-lockfile --ignore-scripts

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
