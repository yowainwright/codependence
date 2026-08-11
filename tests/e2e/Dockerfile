# Multi-stage Dockerfile for testing codependence init functionality
ARG NODE_SLIM_IMAGE=node:26-slim@sha256:4ebb5ace66f15a24c14c492e01a8beeed4fddf970a856109f5126e703e5fe503
FROM ${NODE_SLIM_IMAGE} AS builder

ARG BUN_VERSION
ARG BUN_LINUX_X64_SHA256
ARG BUN_LINUX_AARCH64_SHA256
ARG TARGETARCH

# Install curl, unzip and other necessary tools
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY bunfig.toml ./

# Copy workspace directories for dependency installation
COPY page/ ./page/

# Install bun from a pinned release asset
RUN set -eu; \
    detected_arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
    case "$detected_arch" in \
        amd64) bun_arch="x64" ;; \
        arm64) bun_arch="aarch64" ;; \
        *) echo "Unsupported Bun architecture: $detected_arch" >&2; exit 1 ;; \
    esac; \
    case "$bun_arch" in \
        x64) bun_sha="${BUN_LINUX_X64_SHA256:-}" ;; \
        aarch64) bun_sha="${BUN_LINUX_AARCH64_SHA256:-}" ;; \
    esac; \
    if [ -z "$bun_sha" ]; then echo "Missing Bun SHA256 for linux-${bun_arch}" >&2; exit 1; fi; \
    curl -fsSLo /tmp/bun.zip "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-${bun_arch}.zip"; \
    echo "${bun_sha}  /tmp/bun.zip" | sha256sum -c -; \
    unzip -q /tmp/bun.zip -d /tmp; \
    mv "/tmp/bun-linux-${bun_arch}/bun" /usr/local/bin/bun; \
    chmod +x /usr/local/bin/bun; \
    ln -sf /usr/local/bin/bun /usr/local/bin/bunx; \
    rm -rf /tmp/bun.zip "/tmp/bun-linux-${bun_arch}"

# Install dependencies (skip git hooks setup in Docker)
RUN npm install --global @nubjs/nub@0.7.5
RUN nub install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build the project normally
RUN nub run build-dist

# Test stage - clean environment for testing
FROM ${NODE_SLIM_IMAGE} AS test

COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun
COPY --from=builder /usr/local/bin/bunx /usr/local/bin/bunx
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
COPY --from=builder /app/bunfig.toml ./bunfig.toml
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
