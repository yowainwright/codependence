import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import {
  DockerProvider,
  parseDockerFromLine,
  updateDockerFromLine,
} from "../../../src/providers/docker";

describe("DockerProvider", () => {
  const tmpDir = join(__dirname, ".tmp-docker-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  test("reads tagged Dockerfile FROM images", () => {
    const dockerfilePath = join(tmpDir, "Dockerfile");
    writeFileSync(
      dockerfilePath,
      `FROM node:20-alpine AS build
FROM --platform=$BUILDPLATFORM docker.io/library/golang:1.22
FROM scratch
`,
    );

    const provider = new DockerProvider({ isTesting: true });
    const manifest = provider.readManifest(dockerfilePath);

    expect(manifest.dependencies).toEqual({
      node: "20-alpine",
      "docker.io/library/golang": "1.22",
    });
  });

  test("updates Dockerfile FROM image tags", () => {
    const dockerfilePath = join(tmpDir, "Dockerfile");
    writeFileSync(dockerfilePath, "FROM node:20-alpine AS build\n");

    const provider = new DockerProvider({ isTesting: true });
    provider.writeManifest(dockerfilePath, {
      filePath: dockerfilePath,
      dependencies: { node: "22-alpine" },
    });

    const updated = readFileSync(dockerfilePath, "utf8");
    expect(updated).toBe("FROM node:22-alpine AS build\n");
  });

  test("parses and updates FROM lines", () => {
    expect(parseDockerFromLine("FROM ghcr.io/org/app:1.0 AS app")).toEqual({
      name: "ghcr.io/org/app",
      tag: "1.0",
    });

    const updated = updateDockerFromLine("FROM node:20", { node: "22" });
    expect(updated).toBe("FROM node:22");
  });
});
