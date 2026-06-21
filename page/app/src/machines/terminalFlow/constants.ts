import {
  SPOTLIGHT_TAB_DELAY_MS,
  type MaintenanceMode,
  type SpotlightSnippetId,
} from "@/components/home/terminalModel";

export const TERMINAL_FLOW_MACHINE_IDS = {
  SPOTLIGHT: "spotlightTerminal",
  MAINTENANCE_MODE: "maintenanceMode",
} as const;

export const TERMINAL_FLOW_STATES = {
  IDLE: "idle",
  ROTATING: "rotating",
  READY: "ready",
} as const;

export const TERMINAL_FLOW_EVENTS = {
  START: "START",
  NEXT: "NEXT",
  SELECT: "SELECT",
  SELECT_MODE: "SELECT_MODE",
} as const;

export const TERMINAL_FLOW_DEFAULTS = {
  SPOTLIGHT_SNIPPET_ID: "check" satisfies SpotlightSnippetId,
  MAINTENANCE_MODE: "dry-run" satisfies MaintenanceMode,
} as const;

export const TERMINAL_FLOW_DELAYS = {
  SPOTLIGHT_ROTATION_MS: SPOTLIGHT_TAB_DELAY_MS,
} as const;
