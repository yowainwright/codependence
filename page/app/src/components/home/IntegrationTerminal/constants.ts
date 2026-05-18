import type { AnimationStep } from "./types";

export const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
];

export const TYPING_SPEED_MS = 15;
export const SPINNER_FRAME_MS = 80;
export const LOOP_DELAY_MS = 3000;

export const ANIMATION_STEPS: AnimationStep[] = [
  {
    type: "type",
    lines: [
      { text: "$ ", color: "text-secondary" },
      { text: "codependence", color: "text-base-content" },
    ],
  },
  { type: "pause", duration: 300 },
  { type: "spinner", duration: 2000, text: "checking version policy..." },
  {
    type: "type",
    lines: [
      { text: "\n\n", color: "" },
      { text: "Policy drift detected", color: "text-warning" },
    ],
  },
  { type: "pause", duration: 150 },
  {
    type: "type",
    lines: [
      { text: "\n", color: "" },
      { text: "react ", color: "text-base-content" },
      { text: "19.0.0", color: "text-warning" },
      { text: " -> ", color: "text-base-content/50" },
      { text: "^18.3.1", color: "text-success" },
      { text: " pinned", color: "text-base-content/50" },
    ],
  },
  { type: "pause", duration: 150 },
  {
    type: "type",
    lines: [
      { text: "\n", color: "" },
      { text: "typescript ", color: "text-base-content" },
      { text: "5.7.0", color: "text-warning" },
      { text: " -> ", color: "text-base-content/50" },
      { text: "^5.9.3", color: "text-success" },
      { text: " pinned", color: "text-base-content/50" },
    ],
  },
  { type: "pause", duration: 150 },
  {
    type: "type",
    lines: [
      { text: "\n", color: "" },
      { text: "express ", color: "text-base-content" },
      { text: "4.18.2", color: "text-warning" },
      { text: " -> ", color: "text-base-content/50" },
      { text: "4.21.2", color: "text-success" },
      { text: " allowed", color: "text-base-content/50" },
    ],
  },
  { type: "pause", duration: 300 },
  {
    type: "type",
    lines: [
      { text: "\n\n", color: "" },
      { text: "Result: ", color: "text-base-content/70" },
      { text: "CI should fail until policy is applied", color: "text-error" },
    ],
  },
];
