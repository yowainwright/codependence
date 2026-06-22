import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ANSI_CLASS_NAMES,
  STYLES,
  TERMINAL_DEFAULT_CONTENT_CLASS,
  TERMINAL_TRANSCRIPT_MOTION,
} from "./constants";
import type {
  TerminalLine,
  TerminalTranscriptProps,
  TerminalWindowProps,
} from "./types";

export type {
  AnsiColor,
  SegmentEntry,
  TerminalLine,
  TerminalSegment,
  TerminalTab,
  TerminalTranscriptProps,
  TerminalWindowProps,
} from "./types";
export {
  ANSI_CLASS_NAMES,
  LANGUAGE_TERMINAL_CONTENT_CLASS,
  SPOTLIGHT_TERMINAL_CONTENT_CLASS,
  STYLES,
  TERMINAL_DEFAULT_CONTENT_CLASS,
  TERMINAL_FRAME_CLASS,
  TERMINAL_FRAME_MAX_WIDTH_CLASS,
  TERMINAL_TARGET_COLUMNS,
  TERMINAL_TRANSCRIPT_MOTION,
} from "./constants";

export function TerminalWindow({
  fileName = "terminal",
  tabs,
  activeTab,
  onTabChange,
  hideHeader = false,
  footer,
  footerClassName,
  children,
  className,
}: TerminalWindowProps) {
  const hasTabs = Boolean(tabs?.length);
  const headerClass = hasTabs ? STYLES.headerWithTabs : STYLES.header;
  const labelClass = hasTabs ? STYLES.labelWithTabs : STYLES.label;

  return (
    <div className={joinClassNames(STYLES.window, className)}>
      {!hideHeader && (
        <div className={headerClass}>
          <div className={STYLES.dots}>
            <span className={STYLES.dotRed} aria-hidden="true" />
            <span className={STYLES.dotYellow} aria-hidden="true" />
            <span className={STYLES.dotGreen} aria-hidden="true" />
            <span className={labelClass}>{fileName}</span>
          </div>

          {hasTabs ? (
            <div className={STYLES.tabs}>
              {tabs?.map((tab) => {
                const isActive = activeTab === tab.id;
                const tabClass = isActive ? STYLES.tabActive : STYLES.tab;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange?.(tab.id)}
                    aria-pressed={isActive}
                    className={tabClass}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      )}

      {children}

      {footer ? (
        <div className={joinClassNames(STYLES.footer, footerClassName)}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function TerminalTranscript({
  lines,
  className = TERMINAL_DEFAULT_CONTENT_CLASS,
  contentKey,
}: TerminalTranscriptProps) {
  return (
    <div className={joinClassNames(STYLES.content, className)}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.pre
          key={contentKey ?? "terminal-transcript"}
          className={STYLES.code}
          initial={TERMINAL_TRANSCRIPT_MOTION.initial}
          animate={TERMINAL_TRANSCRIPT_MOTION.animate}
          exit={TERMINAL_TRANSCRIPT_MOTION.exit}
          transition={TERMINAL_TRANSCRIPT_MOTION.transition}
        >
          {renderTerminalLines(lines)}
        </motion.pre>
      </AnimatePresence>
    </div>
  );
}

export function renderTerminalLines(lines: TerminalLine[]) {
  const rendered: ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    line.forEach(({ text, className }, segmentIndex) => {
      rendered.push(
        <span
          key={`${lineIndex}-${segmentIndex}`}
          className={className || ANSI_CLASS_NAMES.base}
        >
          {text}
        </span>,
      );
    });

    if (lineIndex < lines.length - 1) {
      rendered.push(<span key={`${lineIndex}-break`}>{"\n"}</span>);
    }
  });

  return rendered;
}

export function TerminalLoader() {
  return (
    <TerminalWindow className={STYLES.loader}>
      <div className={STYLES.content}>
        <div className={`${STYLES.loaderBar} mb-2 w-3/4`} />
        <div className={`${STYLES.loaderBar} mb-2 w-1/2`} />
        <div className={`${STYLES.loaderBar} w-2/3`} />
      </div>
    </TerminalWindow>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}
