import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { DockerProvider } from "../../../src/providers/docker";

describe("DockerProvider", () => {
  const tmpDir = join(__dirname, ".tmp-docker-test");
  const dockerfilePath = join(tmpDir, "Dockerfile");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("should expose provider metadata", async () => {
    const provider = new DockerProvider();

    expect(provider.language).toBe("docker");
    expect(provider.capabilities).toEqual({
      supportsLatestResolution: false,
      supportsPreciseMode: false,
      versionStrategy: "exact",
    });
    await expect(provider.getLatestVersion("node")).rejects.toThrow(
      "Docker provider requires explicit version pins",
    );
    await expect(provider.getAllVersions("node")).rejects.toThrow(
      "Docker provider requires explicit version pins",
    );
    expect(provider.validatePackageName("ghcr.io/org/image")).toBe(true);
    expect(provider.validatePackageName("registry.internal:5000/org/image")).toBe(true);
    expect(provider.validatePackageName("bad image")).toBe(false);
  });

  test("should read Dockerfile image tags", () => {
    const content = `FROM node:20.11.1 AS build
FROM --platform=linux/amd64 nginx:1.25
ARG ALPINE_VERSION=3.19
FROM alpine:\${ALPINE_VERSION}
FROM debian:\${DEBIAN_VERSION}
FROM alpine@sha256:abc123
FROM scratch
`;
    writeFileSync(dockerfilePath, content);

    const provider = new DockerProvider();
    const manifest = provider.readManifest(dockerfilePath);

    expect(manifest.dependencies).toEqual({
      node: "20.11.1",
      nginx: "1.25",
      alpine: "3.19",
    });
  });

  test("should update Dockerfile image tags", () => {
    const content = `FROM node:20.11.1 AS build
FROM --platform=linux/amd64 nginx:1.25
ARG ALPINE_VERSION=3.19
FROM alpine:\${ALPINE_VERSION}
FROM debian:\${DEBIAN_VERSION}
FROM alpine@sha256:abc123
FROM scratch
`;
    writeFileSync(dockerfilePath, content);

    const provider = new DockerProvider();
    provider.writeManifest(dockerfilePath, {
      filePath: dockerfilePath,
      dependencies: {
        node: "22.0.0",
        nginx: "1.27",
        alpine: "3.20",
        scratch: "latest",
      },
    });

    const updated = readFileSync(dockerfilePath, "utf8");

    expect(updated).toContain("FROM node:22.0.0 AS build");
    expect(updated).toContain("FROM --platform=linux/amd64 nginx:1.27");
    expect(updated).toContain("ARG ALPINE_VERSION=3.20");
    expect(updated).toContain("FROM alpine:${ALPINE_VERSION}");
    expect(updated).toContain("FROM debian:${DEBIAN_VERSION}");
    expect(updated).toContain("FROM alpine@sha256:abc123");
    expect(updated).toContain("FROM scratch");
  });

  test("should preserve ARG formatting and static tag suffixes", () => {
    const content = `ARG NODE_VERSION = "20.11.1" # shared runtime
FROM node:\${NODE_VERSION}-slim AS build
`;
    writeFileSync(dockerfilePath, content);

    const provider = new DockerProvider();
    const manifest = provider.readManifest(dockerfilePath);
    expect(manifest.dependencies).toEqual({ node: "20.11.1-slim" });

    provider.writeManifest(dockerfilePath, {
      filePath: dockerfilePath,
      dependencies: { node: "24.0.0-slim" },
    });

    const updated = readFileSync(dockerfilePath, "utf8");
    expect(updated).toContain('ARG NODE_VERSION = "24.0.0" # shared runtime');
    expect(updated).toContain("FROM node:${NODE_VERSION}-slim AS build");
  });
});
