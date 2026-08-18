import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { assertCalledWith } from "../helpers/assertions";
import inquirerCheckbox from "@inquirer/checkbox";
import inquirerSelect from "@inquirer/select";
import {
  createOutput,
  defaultOutput,
  getTerminalWidth,
  visibleLength,
  pad,
  truncate,
  indent,
  line,
  item,
  divider,
  box,
  radio,
  select,
} from "../../src/dx";

describe("DX Utilities", () => {
  describe("Output", () => {
    let mockStream: any;

    beforeEach(() => {
      mockStream = {
        write: mock.fn(),
      };
    });

    it("should create output with custom stream", () => {
      const output = createOutput(mockStream);

      output.write("test");
      assertCalledWith((mockStream.write), "test");
    });

    it("should write line with newline", () => {
      const output = createOutput(mockStream);

      output.writeLine("test");
      assertCalledWith((mockStream.write), "test\n");
    });

    it("should clear line", () => {
      const output = createOutput(mockStream);

      output.clearLine();
      assertCalledWith((mockStream.write), "\r\x1b[K");
    });

    it("should hide cursor", () => {
      const output = createOutput(mockStream);

      output.hideCursor();
      assertCalledWith((mockStream.write), "\x1b[?25l");
    });

    it("should show cursor", () => {
      const output = createOutput(mockStream);

      output.showCursor();
      assertCalledWith((mockStream.write), "\x1b[?25h");
    });

    it("should use default output", () => {
      assert.notStrictEqual((defaultOutput), undefined);
      assert.notStrictEqual((defaultOutput.write), undefined);
    });
  });

  describe("Prompt styles", () => {
    it("should use a single-choice prompt for radio", () => {
      assert.strictEqual((radio), inquirerSelect);
    });

    it("should use a multi-choice prompt for select", () => {
      assert.strictEqual((select), inquirerCheckbox);
    });
  });

  describe("Format Utilities", () => {
    it("should get terminal width", () => {
      const width = getTerminalWidth();
      assert.strictEqual((typeof width), "number");
      assert.ok((width) > 0);
    });

    it("should calculate visible length without ANSI codes", () => {
      assert.strictEqual((visibleLength("hello")), 5);
      assert.strictEqual((visibleLength("\x1b[31mhello\x1b[0m")), 5);
      assert.strictEqual((visibleLength("\x1b[1;32mtest\x1b[0m")), 4);
    });

    it("should pad strings left by default", () => {
      assert.strictEqual((pad("test", 8)), "test    ");
    });

    it("should pad strings right", () => {
      assert.strictEqual((pad("test", 8, "right")), "    test");
    });

    it("should pad strings center", () => {
      assert.strictEqual((pad("test", 8, "center")), "  test  ");
      assert.strictEqual((pad("test", 9, "center")), "  test   ");
    });

    it("should not pad if string is already long enough", () => {
      assert.strictEqual((pad("testing", 5)), "testing");
    });

    it("should truncate long strings", () => {
      assert.strictEqual((truncate("hello world", 8)), "hello...");
      assert.strictEqual((truncate("short", 10)), "short");
    });

    it("should handle truncate edge cases", () => {
      assert.strictEqual((truncate("test", 3)), "...");
      assert.strictEqual((truncate("test", 2)), "..");
      assert.strictEqual((truncate("test", 1)), ".");
    });

    it("should indent text", () => {
      assert.strictEqual((indent("test")), "  test");
      assert.strictEqual((indent("test", 4)), "    test");
    });

    it("should add line prefix", () => {
      assert.strictEqual((line("test")), "\ntest");
    });

    it("should format numbered items", () => {
      assert.strictEqual((item(1, "test")), "  1. test");
      assert.strictEqual((item(5, "item", 4)), "    5. item");
    });

    it("should create dividers", () => {
      const div = divider("-", 10);
      assert.strictEqual((div), "----------");
    });

    it("should create dividers with default length", () => {
      const div = divider();
      assert.strictEqual((typeof div), "string");
      assert.ok((div.length) > 0);
    });

    it("should create boxes", () => {
      const lines = ["Hello", "World"];
      const boxed = box(lines);

      assert.strictEqual((boxed).length, 4);
      assert.match((boxed[0]), /^┌.*┐$/);
      assert.match((boxed[1]), /^│.*│$/);
      assert.match((boxed[2]), /^│.*│$/);
      assert.match((boxed[3]), /^└.*┘$/);
    });

    it("should create boxes with title", () => {
      const lines = ["Content"];
      const boxed = box(lines, { title: "Test" });

      assert.ok((boxed[0]).includes("Test"));
    });

    it("should create boxes with custom width", () => {
      const lines = ["Short"];
      const boxed = box(lines, { width: 20 });

      assert.strictEqual((boxed[0]).length, 20);
    });

    it("should create boxes with custom padding", () => {
      const lines = ["Test"];
      const boxed = box(lines, { padding: 3 });

      assert.match((boxed[1]), /^│   Test.*   │$/);
    });

    it("should handle empty box content", () => {
      const boxed = box([]);
      assert.strictEqual((boxed).length, 2);
    });
  });
});
