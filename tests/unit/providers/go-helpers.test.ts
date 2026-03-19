import { describe, test, expect } from "bun:test";
import {
  parseRequireBlock,
  parseSingleRequires,
  buildRequireBlock,
} from "../../../src/providers/go";

describe("parseRequireBlock", () => {
  test("parses multi-line require block", () => {
    const content = `module example.com/app

require (
\tgithub.com/gin-gonic/gin v1.9.1
\tgithub.com/lib/pq v1.10.9
)`;

    const result = parseRequireBlock(content);

    expect(result).toEqual({
      "github.com/gin-gonic/gin": "v1.9.1",
      "github.com/lib/pq": "v1.10.9",
    });
  });

  test("returns empty object when no require block", () => {
    const content = "module example.com/app\n\ngo 1.21\n";

    expect(parseRequireBlock(content)).toEqual({});
  });

  test("ignores blank lines in require block", () => {
    const content = `require (
\tgithub.com/pkg1 v1.0.0

\tgithub.com/pkg2 v2.0.0
)`;

    const result = parseRequireBlock(content);

    expect(result).toEqual({
      "github.com/pkg1": "v1.0.0",
      "github.com/pkg2": "v2.0.0",
    });
  });

  test("handles require block with comments (indirect)", () => {
    const content = `require (
\tgithub.com/pkg1 v1.0.0
\tgithub.com/pkg2 v2.0.0 // indirect
)`;

    const result = parseRequireBlock(content);

    expect(result["github.com/pkg1"]).toBe("v1.0.0");
    expect(result["github.com/pkg2"]).toBeDefined();
  });

  test("handles empty require block", () => {
    const content = "require (\n)";

    expect(parseRequireBlock(content)).toEqual({});
  });
});

describe("parseSingleRequires", () => {
  test("parses single require statements", () => {
    const content = `module example.com/app

go 1.21

require github.com/stretchr/testify v1.8.4
require github.com/joho/godotenv v1.5.1
`;

    const result = parseSingleRequires(content);

    expect(result).toEqual({
      "github.com/stretchr/testify": "v1.8.4",
      "github.com/joho/godotenv": "v1.5.1",
    });
  });

  test("returns empty object when no single requires", () => {
    const content = "module example.com/app\n\ngo 1.21\n";

    expect(parseSingleRequires(content)).toEqual({});
  });

  test("does not match require blocks", () => {
    const content = `require (
\tgithub.com/pkg v1.0.0
)`;

    expect(parseSingleRequires(content)).toEqual({});
  });

  test("handles single require statement", () => {
    const content = "require github.com/pkg v1.0.0\n";

    const result = parseSingleRequires(content);

    expect(result).toEqual({ "github.com/pkg": "v1.0.0" });
  });
});

describe("buildRequireBlock", () => {
  test("builds formatted require block", () => {
    const deps = {
      "github.com/gin-gonic/gin": "v1.9.1",
      "github.com/lib/pq": "v1.10.9",
    };

    const result = buildRequireBlock(deps);

    expect(result).toContain("require (");
    expect(result).toContain("\tgithub.com/gin-gonic/gin v1.9.1");
    expect(result).toContain("\tgithub.com/lib/pq v1.10.9");
    expect(result).toContain(")");
  });

  test("builds block with single dependency", () => {
    const deps = { "github.com/pkg": "v1.0.0" };

    const result = buildRequireBlock(deps);

    expect(result).toBe("require (\n\tgithub.com/pkg v1.0.0\n)");
  });

  test("builds empty require block", () => {
    const result = buildRequireBlock({});

    expect(result).toBe("require (\n\n)");
  });

  test("uses tab indentation for entries", () => {
    const deps = { "github.com/pkg": "v1.0.0" };

    const result = buildRequireBlock(deps);
    const lines = result.split("\n");

    expect(lines[1].startsWith("\t")).toBe(true);
  });
});
