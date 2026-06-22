import type { AnsiColor } from "./types";

export const ANSI_CLASS_NAMES: Record<AnsiColor | "boldCyan" | "base", string> =
  {
    base: "text-base-content",
    boldCyan: "font-semibold text-cyan-400",
    cyan: "text-cyan-400",
    gray: "text-base-content/50",
    green: "text-success",
    red: "text-error",
    yellow: "text-warning",
  };

export const TERMINAL_FRAME_MAX_WIDTH_CLASS = "max-w-[46rem]";
export const TERMINAL_FRAME_CLASS = `spotlight-frame w-full min-w-0 ${TERMINAL_FRAME_MAX_WIDTH_CLASS}`;
export const SPOTLIGHT_TERMINAL_CONTENT_CLASS = "h-[420px]";
export const LANGUAGE_TERMINAL_CONTENT_CLASS = "h-[390px]";
export const TERMINAL_DEFAULT_CONTENT_CLASS = SPOTLIGHT_TERMINAL_CONTENT_CLASS;
export const TERMINAL_TARGET_COLUMNS = 80;

export const TERMINAL_TRANSCRIPT_MOTION = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.16, ease: "easeOut" },
} as const;

export const STYLES = {
  window: "terminal-window w-full",
  header: "terminal-header",
  headerWithTabs: "terminal-header terminal-header-with-tabs",
  dots: "flex min-w-0 items-center gap-2",
  dotRed: "terminal-dot terminal-dot-red",
  dotYellow: "terminal-dot terminal-dot-yellow",
  dotGreen: "terminal-dot terminal-dot-green",
  label: "ml-3 truncate text-xs text-slate-400",
  labelWithTabs: "ml-3 hidden text-xs text-slate-400 sm:inline",
  tabs: "terminal-tabs",
  tab: "terminal-tab",
  tabActive: "terminal-tab active",
  content: "terminal-content",
  code: "terminal-code",
  footer: "terminal-footer",
  loader: "terminal-window w-full animate-pulse",
  loaderBar: "h-4 rounded bg-base-content/10",
} as const;
