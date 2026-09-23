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

    assert.match(result, /Dependency Risk Legend/);
    assert.match(result, /Patch/);
    assert.match(result, /Minor/);
    assert.match(result, /Major/);
    assert.match(result, /Unknown/);
  });

  it("formats the composed styleguide", () => {
    const result = stripAnsi(formatCliStyleguide());

    assert.match(result, /Codependence CLI Styleguide/);
    assert.match(result, /✓ pinned!/);
    assert.match(result, /✗ dependencies are not correct/);
    assert.match(result, /Dependency Risk Legend/);
    assert.match(result, /Dependency Updates Available:/);
    assert.match(result, /Updated Dependencies:/);
    assert.match(result, /Loader\n🤼‍♀️ codependence wrestling\.\.\./);
  });
});
