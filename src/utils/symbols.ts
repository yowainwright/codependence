import { green, red, yellow, cyan, gray } from "./colors";

export const SYMBOLS = {
  success: green("✓"),
  error: red("✗"),
  warning: yellow("▲"),
  info: cyan("◆"),
  pinned: yellow("■"),
  dot: gray("·"),

  severityMajor: red("●"),
  severityMinor: yellow("●"),
  severityPatch: green("●"),

  arrow: cyan(">"),
  bullet: gray(">"),
} as const;

export const RAW_SYMBOLS = {
  success: "✓",
  error: "✗",
  warning: "▲",
  info: "◆",
  pinned: "■",
  dot: "·",
  severityMajor: "●",
  severityMinor: "●",
  severityPatch: "●",
  arrow: ">",
  bullet: ">",
} as const;
