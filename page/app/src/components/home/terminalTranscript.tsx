import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ANSI_CLASS_NAMES,
  TERMINAL_FRAME_CLASS,
  type TerminalLine,
  type TerminalTab,
} from "@/components/home/terminalModel";

type TerminalWindowProps = {
  title?: string;
  lines: TerminalLine[];
  tabs?: TerminalTab[];
  activeTabId?: string;
  onTabClick?: (id: string) => void;
  contentClassName?: string;
  contentKey?: string;
};

export { TERMINAL_FRAME_CLASS };
export type { TerminalLine, TerminalTab };

export function TerminalWindow({
  title = "terminal",
  lines,
  tabs,
  activeTabId,
  onTabClick,
  contentClassName = "h-[420px]",
  contentKey,
}: TerminalWindowProps) {
  const hasTabs = Boolean(tabs?.length);
  const transcriptKey = contentKey ?? activeTabId ?? title;

  return (
    <div className="terminal-window w-full">
      <div
        className={
          hasTabs
            ? "terminal-header terminal-header-with-tabs"
            : "terminal-header"
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="terminal-dot terminal-dot-red" aria-hidden="true" />
          <span
            className="terminal-dot terminal-dot-yellow"
            aria-hidden="true"
          />
          <span
            className="terminal-dot terminal-dot-green"
            aria-hidden="true"
          />
          <span
            className={
              hasTabs
                ? "ml-3 hidden text-xs text-slate-400 sm:inline"
                : "ml-3 truncate text-xs text-slate-400"
            }
          >
            {title}
          </span>
        </div>

        {hasTabs ? (
          <div className="terminal-tabs">
            {tabs?.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabClick?.(tab.id)}
                aria-pressed={activeTabId === tab.id}
                className={
                  activeTabId === tab.id
                    ? "terminal-tab active"
                    : "terminal-tab"
                }
              >
                {tab.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={joinClassNames("terminal-content", contentClassName)}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.pre
            key={transcriptKey}
            className="terminal-code"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {renderTerminalLines(lines)}
          </motion.pre>
        </AnimatePresence>
      </div>
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

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}
