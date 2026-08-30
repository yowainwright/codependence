import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAnsiPattern } from "../../../../src/dx/constants";
import { formatCliLegend, formatCliLoader, formatCliStyleguide } from "../../../../src/dx/output";

const stripAnsi = (value: string): string => value.replace(createAnsiPattern(), "");

describe("CLI styleguide", () => {
  it("formats the live loader preview", () => {
    const result = stripAnsi(formatCliLoader(0));

    assert.strictEqual(result, "Loader\n🤼‍♀️ codependence wrestling...");
  });

  it("formats the dependency risk legend", () => {
    const result = stripAnsi(formatCliLegend());

    assert.ok(result.includes("Dependency Risk Legend"));
    assert.ok(result.includes("Patch"));
    assert.ok(result.includes("Minor"));
    assert.ok(result.includes("Major"));
    assert.ok(result.includes("Unknown"));
  });

  it("formats the composed styleguide", () => {
    const result = stripAnsi(formatCliStyleguide());

    assert.ok(result.includes("Codependence CLI Styleguide"));
    assert.ok(result.includes("✓ pinned!"));
    assert.ok(result.includes("✗ dependencies are not correct"));
    assert.ok(result.includes("Dependency Risk Legend"));
    assert.ok(result.includes("Dependency Updates Available:"));
    assert.ok(result.includes("Updated Dependencies:"));
    assert.ok(result.includes("Loader\n🤼‍♀️ codependence wrestling..."));
  });
});
