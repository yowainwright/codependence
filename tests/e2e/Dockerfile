# Multi-stage Dockerfile for testing codependence init functionality
ARG NODE_SLIM_IMAGE=node:26-slim@sha256:4ebb5ace66f15a24c14c492e01a8beeed4fddf970a856109f5126e703e5fe503
FROM ${NODE_SLIM_IMAGE} AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Copy workspace directories for dependency installation
COPY page/ ./page/

# Install dependencies (skip git hooks setup in Docker)
RUN npm install --global @nubjs/nub@0.7.5
RUN nub install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build the project normally
RUN nub run build-dist

# Test stage - clean environment for testing
FROM ${NODE_SLIM_IMAGE} AS test

RUN npm install --global @nubjs/nub@0.7.5

# Create a non-root user for testing
RUN groupadd -g 1001 testuser && \
    useradd -r -u 1001 -g testuser -m testuser

# Set working directory
WORKDIR /test

# Copy built distribution and necessary files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/page ./page

# Install only production dependencies when they exist
RUN if node -e "const pkg = require('./package.json'); process.exit(Object.keys(pkg.dependencies || {}).length === 0 ? 0 : 1)"; then \
        echo "No production dependencies to install"; \
    else \
        nub install --prod --frozen-lockfile --ignore-scripts; \
    fi

# Copy test fixtures
COPY tests/e2e/fixtures/* ./

# Make test script executable
RUN chmod +x test-init.sh

# Change ownership to test user
RUN chown -R testuser:testuser /test

# Switch to test user
USER testuser

# Set default command
CMD ["./test-init.sh"]
