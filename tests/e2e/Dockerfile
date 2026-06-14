# Multi-stage Dockerfile for testing codependence init functionality
ARG NODE_SLIM_IMAGE=node:24-slim@sha256:2c87ef9bd3c6a3bd4b472b4bec2ce9d16354b0c574f736c476489d09f560a203
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
COPY bun.lock ./
COPY bunfig.toml ./

# Copy workspace directories (needed for bun install with workspaces)
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
RUN bun install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build the project normally
RUN bun run build-dist

# Test stage - clean environment for testing
FROM ${NODE_SLIM_IMAGE} AS test

COPY --from=builder /usr/local/bin/bun /usr/local/bin/bun
COPY --from=builder /usr/local/bin/bunx /usr/local/bin/bunx

# Create a non-root user for testing
RUN groupadd -g 1001 testuser && \
    useradd -r -u 1001 -g testuser -m testuser

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
COPY tests/e2e/fixtures/* ./

# Make test script executable
RUN chmod +x test-init.sh

# Change ownership to test user
RUN chown -R testuser:testuser /test

# Switch to test user
USER testuser

# Set default command
CMD ["./test-init.sh"]
