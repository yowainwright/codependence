import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
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
} from "../../src/dx";

describe("DX Utilities", () => {
  describe("Output", () => {
    let mockStream: any;

    beforeEach(() => {
      mockStream = {
        write: jest.fn(),
      };
    });

    it("should create output with custom stream", () => {
      const output = createOutput(mockStream);

      output.write("test");
      expect(mockStream.write).toHaveBeenCalledWith("test");
    });

    it("should write line with newline", () => {
      const output = createOutput(mockStream);

      output.writeLine("test");
      expect(mockStream.write).toHaveBeenCalledWith("test\n");
    });

    it("should clear line", () => {
      const output = createOutput(mockStream);

      output.clearLine();
      expect(mockStream.write).toHaveBeenCalledWith("\r\x1b[K");
    });

    it("should hide cursor", () => {
      const output = createOutput(mockStream);

      output.hideCursor();
      expect(mockStream.write).toHaveBeenCalledWith("\x1b[?25l");
    });

    it("should show cursor", () => {
      const output = createOutput(mockStream);

      output.showCursor();
      expect(mockStream.write).toHaveBeenCalledWith("\x1b[?25h");
    });

    it("should use default output", () => {
      expect(defaultOutput).toBeDefined();
      expect(defaultOutput.write).toBeDefined();
    });
  });

  describe("Format Utilities", () => {
    it("should get terminal width", () => {
      const width = getTerminalWidth();
      expect(typeof width).toBe("number");
      expect(width).toBeGreaterThan(0);
    });

    it("should calculate visible length without ANSI codes", () => {
      expect(visibleLength("hello")).toBe(5);
      expect(visibleLength("\x1b[31mhello\x1b[0m")).toBe(5);
      expect(visibleLength("\x1b[1;32mtest\x1b[0m")).toBe(4);
    });

    it("should pad strings left by default", () => {
      expect(pad("test", 8)).toBe("test    ");
    });

    it("should pad strings right", () => {
      expect(pad("test", 8, "right")).toBe("    test");
    });

    it("should pad strings center", () => {
      expect(pad("test", 8, "center")).toBe("  test  ");
      expect(pad("test", 9, "center")).toBe("  test   ");
    });

    it("should not pad if string is already long enough", () => {
      expect(pad("testing", 5)).toBe("testing");
    });

    it("should truncate long strings", () => {
      expect(truncate("hello world", 8)).toBe("hello...");
      expect(truncate("short", 10)).toBe("short");
    });

    it("should handle truncate edge cases", () => {
      expect(truncate("test", 3)).toBe("...");
      expect(truncate("test", 2)).toBe("..");
      expect(truncate("test", 1)).toBe(".");
    });

    it("should indent text", () => {
      expect(indent("test")).toBe("  test");
      expect(indent("test", 4)).toBe("    test");
    });

    it("should add line prefix", () => {
      expect(line("test")).toBe("\ntest");
    });

    it("should format numbered items", () => {
      expect(item(1, "test")).toBe("  1. test");
      expect(item(5, "item", 4)).toBe("    5. item");
    });

    it("should create dividers", () => {
      const div = divider("-", 10);
      expect(div).toBe("----------");
    });

    it("should create dividers with default length", () => {
      const div = divider();
      expect(typeof div).toBe("string");
      expect(div.length).toBeGreaterThan(0);
    });

    it("should create boxes", () => {
      const lines = ["Hello", "World"];
      const boxed = box(lines);

      expect(boxed).toHaveLength(4); // top + 2 content + bottom
      expect(boxed[0]).toMatch(/^┌.*┐$/);
      expect(boxed[1]).toMatch(/^│.*│$/);
      expect(boxed[2]).toMatch(/^│.*│$/);
      expect(boxed[3]).toMatch(/^└.*┘$/);
    });

    it("should create boxes with title", () => {
      const lines = ["Content"];
      const boxed = box(lines, { title: "Test" });

      expect(boxed[0]).toContain("Test");
    });

    it("should create boxes with custom width", () => {
      const lines = ["Short"];
      const boxed = box(lines, { width: 20 });

      expect(boxed[0]).toHaveLength(20);
    });

    it("should create boxes with custom padding", () => {
      const lines = ["Test"];
      const boxed = box(lines, { padding: 3 });

      expect(boxed[1]).toMatch(/^│   Test.*   │$/);
    });

    it("should handle empty box content", () => {
      const boxed = box([]);
      expect(boxed).toHaveLength(2); // just top and bottom
    });
  });
});