import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { assertThrows } from "../../helpers/assertions";
import {
  detectLanguage,
  detectPrimaryLanguage,
  getLanguageProvider,
} from "../../../src/providers/utils";
import { NodeJSProvider } from "../../../src/providers/nodejs";
import { GoProvider } from "../../../src/providers/go";
import { PythonProvider } from "../../../src/providers/python";
import { RustProvider } from "../../../src/providers/rust";
import { CircleCIProvider } from "../../../src/providers/circleci";
import { DockerProvider } from "../../../src/providers/docker";
import { GitHubActionsProvider } from "../../../src/providers/github-actions";
import { HelmProvider } from "../../../src/providers/helm";
import { KubernetesProvider } from "../../../src/providers/kubernetes";
import { KustomizeProvider } from "../../../src/providers/kustomize";
import { TerraformProvider } from "../../../src/providers/terraform";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("Language Detection", () => {
  const tmpDir = join(import.meta.dirname, ".tmp-detection-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  describe("detectLanguage - Node.js", () => {
    test("should detect Node.js with npm", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].language, "nodejs");
      assert.deepStrictEqual(result[0].manifestFiles, ["package.json"]);
      assert.strictEqual(result[0].packageManager, "npm");
    });

    test("should detect Node.js with yarn", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "yarn.lock"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "yarn");
    });

    test("should detect Node.js with pnpm", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "pnpm");
    });

    test("should detect Node.js with bun", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "bun.lockb"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "bun");
    });

    test("should detect Node.js with current bun.lock", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "bun.lock"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "bun");
    });

    test("should detect Node.js from packageManager field", () => {
      writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ packageManager: "pnpm@9.0.0" }));

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "pnpm");
    });

    test("should prioritize bun over pnpm over yarn over npm", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "yarn.lock"), "");
      writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");
      writeFileSync(join(tmpDir, "bun.lockb"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "bun");
    });
  });

  describe("detectLanguage - Go", () => {
    test("should detect Go with go.mod", () => {
      writeFileSync(join(tmpDir, "go.mod"), "module test");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].language, "go");
      assert.deepStrictEqual(result[0].manifestFiles, ["go.mod"]);
      assert.strictEqual(result[0].packageManager, "go");
    });

    test("should detect Go with go.mod and go.sum", () => {
      writeFileSync(join(tmpDir, "go.mod"), "module test");
      writeFileSync(join(tmpDir, "go.sum"), "");

      const result = detectLanguage(tmpDir);

      assert.deepStrictEqual(result[0].manifestFiles, ["go.mod", "go.sum"]);
    });
  });

  describe("detectLanguage - Rust", () => {
    test("should detect Rust with Cargo.toml", () => {
      writeFileSync(join(tmpDir, "Cargo.toml"), "[package]");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].language, "rust");
      assert.deepStrictEqual(result[0].manifestFiles, ["Cargo.toml"]);
      assert.strictEqual(result[0].packageManager, "rust");
    });

    test("should detect Rust with Cargo.lock", () => {
      writeFileSync(join(tmpDir, "Cargo.toml"), "[package]");
      writeFileSync(join(tmpDir, "Cargo.lock"), "");

      const result = detectLanguage(tmpDir);

      assert.deepStrictEqual(result[0].manifestFiles, ["Cargo.toml", "Cargo.lock"]);
    });
  });

  describe("detectLanguage - Docker", () => {
    test("should detect Dockerfile", () => {
      writeFileSync(join(tmpDir, "Dockerfile"), "FROM node:20");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].language, "docker");
      assert.deepStrictEqual(result[0].manifestFiles, ["Dockerfile"]);
      assert.strictEqual(result[0].packageManager, "docker");
    });
  });

  describe("detectLanguage - GitHub Actions", () => {
    test("should detect workflow files", () => {
      const workflowsDir = join(tmpDir, ".github", "workflows");
      mkdirSync(workflowsDir, { recursive: true });
      writeFileSync(join(workflowsDir, "ci.yml"), "name: ci");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].language, "github-actions");
      assert.deepStrictEqual(result[0].manifestFiles, [
        ".github/workflows/*.yml",
        ".github/workflows/*.yaml",
      ]);
      assert.strictEqual(result[0].packageManager, "github-actions");
    });
  });

  describe("detectLanguage - infrastructure manifests", () => {
    test("should detect CircleCI config", () => {
      const circleDir = join(tmpDir, ".circleci");
      mkdirSync(circleDir, { recursive: true });
      writeFileSync(join(circleDir, "config.yml"), "version: 2.1");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].language, "circleci");
      assert.strictEqual(result[0].packageManager, "circleci");
    });

    test("should detect nested Kubernetes manifests in known directories", () => {
      const manifestDir = join(tmpDir, "k8s", "base");
      mkdirSync(manifestDir, { recursive: true });
      writeFileSync(join(manifestDir, "deployment.yaml"), "apiVersion: apps/v1");

      const result = detectLanguage(tmpDir);
      const primary = detectPrimaryLanguage(tmpDir);

      assert.strictEqual(result[0].language, "kubernetes");
      assert.strictEqual(result[0].packageManager, "kubernetes");
      assert.strictEqual(primary?.language, "kubernetes");
    });

    test("should detect Kustomize manifests", () => {
      writeFileSync(join(tmpDir, "kustomization.yaml"), "resources: []");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].language, "kustomize");
      assert.strictEqual(result[0].packageManager, "kustomize");
    });

    test("should detect Terraform manifests", () => {
      writeFileSync(join(tmpDir, "main.tf"), "terraform {}");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].language, "terraform");
      assert.strictEqual(result[0].packageManager, "terraform");
    });
  });

  describe("detectLanguage - Helm", () => {
    test("should detect Helm with Chart.yaml", () => {
      writeFileSync(join(tmpDir, "Chart.yaml"), "apiVersion: v2\nname: web\nversion: 1.0.0\n");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].language, "helm");
      assert.deepStrictEqual(result[0].manifestFiles, ["Chart.yaml"]);
      assert.strictEqual(result[0].packageManager, "helm");
    });
  });

  describe("detectLanguage - Python", () => {
    test("should detect Python with requirements.txt", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "requests==2.31.0");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].language, "python");
      assert.ok(result[0].manifestFiles.includes("requirements.txt"));
      assert.strictEqual(result[0].packageManager, "pip");
    });

    test("should detect Python with pip", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "pip");
    });

    test("should detect Python with poetry", () => {
      writeFileSync(join(tmpDir, "pyproject.toml"), "[tool.poetry.dependencies]\\npython = '^3.8'");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "poetry");
      assert.ok(result[0].manifestFiles.includes("pyproject.toml"));
    });

    test("should detect Python with pipenv", () => {
      writeFileSync(join(tmpDir, "Pipfile"), "[packages]");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "pipenv");
      assert.ok(result[0].manifestFiles.includes("Pipfile"));
    });

    test("should detect Python with conda", () => {
      writeFileSync(join(tmpDir, "environment.yml"), "dependencies:");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "conda");
      assert.ok(result[0].manifestFiles.includes("environment.yml"));
    });

    test("should detect Python with conda using .yaml extension", () => {
      writeFileSync(join(tmpDir, "environment.yaml"), "dependencies:");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "conda");
      assert.ok(result[0].manifestFiles.includes("environment.yaml"));
    });

    test("should detect Python with uv", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "");
      writeFileSync(join(tmpDir, "uv.lock"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "uv");
    });

    test("should include all Python manifest files found", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "");
      writeFileSync(join(tmpDir, "pyproject.toml"), "");

      const result = detectLanguage(tmpDir);

      assert.ok(result[0].manifestFiles.includes("requirements.txt"));
      assert.ok(result[0].manifestFiles.includes("pyproject.toml"));
    });

    test("should detect pyproject.toml without poetry as pip", () => {
      writeFileSync(join(tmpDir, "pyproject.toml"), "[build-system]");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "pip");
    });
  });

  describe("detectLanguage - Multiple languages", () => {
    test("should detect multiple languages in same project", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "go.mod"), "module test");
      writeFileSync(join(tmpDir, "requirements.txt"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result.length, 3);

      const languages = result.map((r) => r.language);
      assert.ok(languages.includes("nodejs"));
      assert.ok(languages.includes("go"));
      assert.ok(languages.includes("python"));
    });

    test("should detect Node.js + Go polyglot", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "go.mod"), "module test");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].language, "nodejs");
      assert.strictEqual(result[1].language, "go");
    });

    test("should detect Node.js + Python polyglot", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "yarn.lock"), "");
      writeFileSync(join(tmpDir, "requirements.txt"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].language, "nodejs");
      assert.strictEqual(result[0].packageManager, "yarn");
      assert.strictEqual(result[1].language, "python");
      assert.strictEqual(result[1].packageManager, "pip");
    });
  });

  describe("detectLanguage - No languages", () => {
    test("should return empty array when no manifests found", () => {
      const result = detectLanguage(tmpDir);

      assert.deepStrictEqual(result, []);
    });

    test("should ignore non-manifest files", () => {
      writeFileSync(join(tmpDir, "README.md"), "");
      writeFileSync(join(tmpDir, "main.js"), "");
      writeFileSync(join(tmpDir, "main.go"), "");

      const result = detectLanguage(tmpDir);

      assert.deepStrictEqual(result, []);
    });
  });

  describe("detectPrimaryLanguage", () => {
    test("should return first detected language", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "go.mod"), "module test");

      const result = detectPrimaryLanguage(tmpDir);

      assert.notStrictEqual(result, null);
      assert.strictEqual(result?.language, "nodejs");
    });

    test("should return null when no languages detected", () => {
      const result = detectPrimaryLanguage(tmpDir);

      assert.strictEqual(result, null);
    });

    test("should ignore unreadable GitHub workflow paths", () => {
      mkdirSync(join(tmpDir, ".github"));
      writeFileSync(join(tmpDir, ".github", "workflows"), "not a directory");

      const result = detectPrimaryLanguage(tmpDir);

      assert.strictEqual(result, null);
    });

    test("should prefer Node.js in mixed projects", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "requirements.txt"), "");

      const result = detectPrimaryLanguage(tmpDir);

      assert.strictEqual(result?.language, "nodejs");
    });
  });

  describe("getLanguageProvider", () => {
    test("should get NodeJSProvider for nodejs", () => {
      const Provider = getLanguageProvider("nodejs");

      assert.strictEqual(Provider, NodeJSProvider);
    });

    test("should get GoProvider for go", () => {
      const Provider = getLanguageProvider("go");

      assert.strictEqual(Provider, GoProvider);
    });

    test("should get PythonProvider for python", () => {
      const Provider = getLanguageProvider("python");

      assert.strictEqual(Provider, PythonProvider);
    });

    test("should get RustProvider for rust", () => {
      const Provider = getLanguageProvider("rust");

      assert.strictEqual(Provider, RustProvider);
    });

    test("should get DockerProvider for docker", () => {
      const Provider = getLanguageProvider("docker");

      assert.strictEqual(Provider, DockerProvider);
    });

    test("should get CircleCIProvider for circleci", () => {
      const Provider = getLanguageProvider("circleci");

      assert.strictEqual(Provider, CircleCIProvider);
    });

    test("should get GitHubActionsProvider for github-actions", () => {
      const Provider = getLanguageProvider("github-actions");

      assert.strictEqual(Provider, GitHubActionsProvider);
    });

    test("should get HelmProvider for helm", () => {
      const Provider = getLanguageProvider("helm");

      assert.strictEqual(Provider, HelmProvider);
    });

    test("should get KubernetesProvider for kubernetes", () => {
      const Provider = getLanguageProvider("kubernetes");

      assert.strictEqual(Provider, KubernetesProvider);
    });

    test("should get KustomizeProvider for kustomize", () => {
      const Provider = getLanguageProvider("kustomize");

      assert.strictEqual(Provider, KustomizeProvider);
    });

    test("should get TerraformProvider for terraform", () => {
      const Provider = getLanguageProvider("terraform");

      assert.strictEqual(Provider, TerraformProvider);
    });

    test("should throw error for unsupported language", () => {
      assertThrows(() => getLanguageProvider("ruby" as any), "Unsupported language: ruby");
    });
  });

  describe("Package Manager Priority", () => {
    test("should prioritize conda for Python when environment.yml exists", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "");
      writeFileSync(join(tmpDir, "environment.yml"), "");
      writeFileSync(join(tmpDir, "Pipfile"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "conda");
    });

    test("should prioritize uv over pipenv for Python", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "");
      writeFileSync(join(tmpDir, "uv.lock"), "");
      writeFileSync(join(tmpDir, "Pipfile"), "");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "uv");
    });

    test("should prioritize pipenv over poetry for Python", () => {
      writeFileSync(join(tmpDir, "Pipfile"), "");
      writeFileSync(join(tmpDir, "pyproject.toml"), "[tool.poetry]\\nname = 'test'");

      const result = detectLanguage(tmpDir);

      assert.strictEqual(result[0].packageManager, "pipenv");
    });
  });
});
