import { expect, test, describe, beforeEach } from "bun:test";
import {
  detectLanguage,
  detectPrimaryLanguage,
  getLanguageProvider,
} from "../../../src/providers/detection";
import { NodeJSProvider } from "../../../src/providers/nodejs";
import { GoProvider } from "../../../src/providers/go";
import { PythonProvider } from "../../../src/providers/python";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

describe("Language Detection", () => {
  const tmpDir = join(__dirname, ".tmp-detection-test");

  beforeEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  });

  describe("detectLanguage - Node.js", () => {
    test("should detect Node.js with npm", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");

      const result = detectLanguage(tmpDir);

      expect(result).toHaveLength(1);
      expect(result[0].language).toBe("nodejs");
      expect(result[0].manifestFiles).toEqual(["package.json"]);
      expect(result[0].packageManager).toBe("npm");
    });

    test("should detect Node.js with yarn", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "yarn.lock"), "");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("yarn");
    });

    test("should detect Node.js with pnpm", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("pnpm");
    });

    test("should detect Node.js with bun", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "bun.lockb"), "");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("bun");
    });

    test("should prioritize bun over pnpm over yarn over npm", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "yarn.lock"), "");
      writeFileSync(join(tmpDir, "pnpm-lock.yaml"), "");
      writeFileSync(join(tmpDir, "bun.lockb"), "");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("bun");
    });
  });

  describe("detectLanguage - Go", () => {
    test("should detect Go with go.mod", () => {
      writeFileSync(join(tmpDir, "go.mod"), "module test");

      const result = detectLanguage(tmpDir);

      expect(result).toHaveLength(1);
      expect(result[0].language).toBe("go");
      expect(result[0].manifestFiles).toEqual(["go.mod"]);
      expect(result[0].packageManager).toBe("go");
    });

    test("should detect Go with go.mod and go.sum", () => {
      writeFileSync(join(tmpDir, "go.mod"), "module test");
      writeFileSync(join(tmpDir, "go.sum"), "");

      const result = detectLanguage(tmpDir);

      expect(result[0].manifestFiles).toEqual(["go.mod", "go.sum"]);
    });
  });

  describe("detectLanguage - Python", () => {
    test("should detect Python with requirements.txt", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "requests==2.31.0");

      const result = detectLanguage(tmpDir);

      expect(result).toHaveLength(1);
      expect(result[0].language).toBe("python");
      expect(result[0].manifestFiles).toContain("requirements.txt");
      expect(result[0].packageManager).toBe("pip");
    });

    test("should detect Python with pip", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("pip");
    });

    test("should detect Python with poetry", () => {
      writeFileSync(
        join(tmpDir, "pyproject.toml"),
        "[tool.poetry.dependencies]\\npython = '^3.8'",
      );

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("poetry");
      expect(result[0].manifestFiles).toContain("pyproject.toml");
    });

    test("should detect Python with pipenv", () => {
      writeFileSync(join(tmpDir, "Pipfile"), "[packages]");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("pipenv");
      expect(result[0].manifestFiles).toContain("Pipfile");
    });

    test("should detect Python with conda", () => {
      writeFileSync(join(tmpDir, "environment.yml"), "dependencies:");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("conda");
      expect(result[0].manifestFiles).toContain("environment.yml");
    });

    test("should detect Python with conda using .yaml extension", () => {
      writeFileSync(join(tmpDir, "environment.yaml"), "dependencies:");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("conda");
      expect(result[0].manifestFiles).toContain("environment.yaml");
    });

    test("should detect Python with uv", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "");
      writeFileSync(join(tmpDir, "uv.lock"), "");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("uv");
    });

    test("should include all Python manifest files found", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "");
      writeFileSync(join(tmpDir, "pyproject.toml"), "");

      const result = detectLanguage(tmpDir);

      expect(result[0].manifestFiles).toContain("requirements.txt");
      expect(result[0].manifestFiles).toContain("pyproject.toml");
    });

    test("should detect pyproject.toml without poetry as pip", () => {
      writeFileSync(join(tmpDir, "pyproject.toml"), "[build-system]");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("pip");
    });
  });

  describe("detectLanguage - Multiple languages", () => {
    test("should detect multiple languages in same project", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "go.mod"), "module test");
      writeFileSync(join(tmpDir, "requirements.txt"), "");

      const result = detectLanguage(tmpDir);

      expect(result).toHaveLength(3);

      const languages = result.map((r) => r.language);
      expect(languages).toContain("nodejs");
      expect(languages).toContain("go");
      expect(languages).toContain("python");
    });

    test("should detect Node.js + Go polyglot", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "go.mod"), "module test");

      const result = detectLanguage(tmpDir);

      expect(result).toHaveLength(2);
      expect(result[0].language).toBe("nodejs");
      expect(result[1].language).toBe("go");
    });

    test("should detect Node.js + Python polyglot", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "yarn.lock"), "");
      writeFileSync(join(tmpDir, "requirements.txt"), "");

      const result = detectLanguage(tmpDir);

      expect(result).toHaveLength(2);
      expect(result[0].language).toBe("nodejs");
      expect(result[0].packageManager).toBe("yarn");
      expect(result[1].language).toBe("python");
      expect(result[1].packageManager).toBe("pip");
    });
  });

  describe("detectLanguage - No languages", () => {
    test("should return empty array when no manifests found", () => {
      const result = detectLanguage(tmpDir);

      expect(result).toEqual([]);
    });

    test("should ignore non-manifest files", () => {
      writeFileSync(join(tmpDir, "README.md"), "");
      writeFileSync(join(tmpDir, "main.js"), "");
      writeFileSync(join(tmpDir, "main.go"), "");

      const result = detectLanguage(tmpDir);

      expect(result).toEqual([]);
    });
  });

  describe("detectPrimaryLanguage", () => {
    test("should return first detected language", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "go.mod"), "module test");

      const result = detectPrimaryLanguage(tmpDir);

      expect(result).not.toBeNull();
      expect(result?.language).toBe("nodejs");
    });

    test("should return null when no languages detected", () => {
      const result = detectPrimaryLanguage(tmpDir);

      expect(result).toBeNull();
    });

    test("should prefer Node.js in mixed projects", () => {
      writeFileSync(join(tmpDir, "package.json"), "{}");
      writeFileSync(join(tmpDir, "requirements.txt"), "");

      const result = detectPrimaryLanguage(tmpDir);

      expect(result?.language).toBe("nodejs");
    });
  });

  describe("getLanguageProvider", () => {
    test("should get NodeJSProvider for nodejs", async () => {
      const Provider = await getLanguageProvider("nodejs");

      expect(Provider).toBe(NodeJSProvider);
    });

    test("should get GoProvider for go", async () => {
      const Provider = await getLanguageProvider("go");

      expect(Provider).toBe(GoProvider);
    });

    test("should get PythonProvider for python", async () => {
      const Provider = await getLanguageProvider("python");

      expect(Provider).toBe(PythonProvider);
    });

    test("should throw error for unsupported language", async () => {
      await expect(getLanguageProvider("rust" as any)).rejects.toThrow(
        "Unsupported language: rust",
      );
    });
  });

  describe("Package Manager Priority", () => {
    test("should prioritize conda for Python when environment.yml exists", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "");
      writeFileSync(join(tmpDir, "environment.yml"), "");
      writeFileSync(join(tmpDir, "Pipfile"), "");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("conda");
    });

    test("should prioritize uv over pipenv for Python", () => {
      writeFileSync(join(tmpDir, "requirements.txt"), "");
      writeFileSync(join(tmpDir, "uv.lock"), "");
      writeFileSync(join(tmpDir, "Pipfile"), "");

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("uv");
    });

    test("should prioritize pipenv over poetry for Python", () => {
      writeFileSync(join(tmpDir, "Pipfile"), "");
      writeFileSync(
        join(tmpDir, "pyproject.toml"),
        "[tool.poetry]\\nname = 'test'",
      );

      const result = detectLanguage(tmpDir);

      expect(result[0].packageManager).toBe("pipenv");
    });
  });
});
