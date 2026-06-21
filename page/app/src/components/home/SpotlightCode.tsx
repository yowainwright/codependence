import { useEffect, useRef, useState, type ReactNode } from "react";

type TranscriptSegment = {
  text: string;
  className?: string;
};

type TranscriptLine = {
  segments: TranscriptSegment[];
};

const snippets: Array<{
  id: string;
  title: string;
  command: string;
  output: TranscriptLine[];
}> = [
  {
    id: "check",
    title: "Check",
    command: "codependence --files test-fail-package.json --rootDir ./tests/unit/fixtures/",
    output: [
      line("codependence", "font-semibold text-cyan-400"),
      line("  🤼‍♀️  Found 2 dependency issues"),
      line("    1. lodash: found 4.17.0, expected 4.17.21"),
      line("    2. fs-extra: found 10.0.0, expected 10.1.0"),
      line(""),
      line("codependence", "text-error"),
      line("  ✗  Dependencies are not correct."),
      line("Error: Dependencies are not correct."),
    ],
  },
  {
    id: "dry-run",
    title: "Dry Run",
    command:
      "codependence --files test-fail-package.json --rootDir ./tests/unit/fixtures/ --update --dryRun",
    output: [
      cliHeader("Dependencies that would be updated:"),
      line("┌──────────────────────┬──────────────┬──────────────┬──────────────┐"),
      segments([
        ["│ "],
        ["Package", "text-cyan-400"],
        ["              │ "],
        ["Current", "text-cyan-400"],
        ["      │ "],
        ["Latest", "text-cyan-400"],
        ["       │ "],
        ["Action", "text-cyan-400"],
        ["       │"],
      ]),
      line("├──────────────────────┼──────────────┼──────────────┼──────────────┤"),
      segments([
        ["│ lodash               │ "],
        ["4.17.0", "text-base-content/50"],
        ["       │ 4.17.21      │ "],
        ["Pinned ■", "text-warning"],
        ["     │"],
      ]),
      segments([
        ["│ fs-extra             │ "],
        ["10.0.0", "text-base-content/50"],
        ["       │ 10.1.0       │ "],
        ["Pinned ■", "text-warning"],
        ["     │"],
      ]),
      line("└──────────────────────┴──────────────┴──────────────┴──────────────┘"),
      line(""),
      line("codependence", "font-semibold text-cyan-400"),
      line("  🤼‍♀️  Found 2 dependency issues"),
      line("    1. lodash: found 4.17.0, expected 4.17.21"),
      line("    2. fs-extra: found 10.0.0, expected 10.1.0"),
      line(""),
      line("codependence", "text-error"),
      line("  ✗  Dependencies are not correct."),
      line("Error: Dependencies are not correct."),
    ],
  },
  {
    id: "update",
    title: "Update",
    command:
      "codependence --files test-fail-package.json --rootDir ./tests/unit/fixtures/ --update --isTesting",
    output: [
      cliHeader("Dependency Updates Available:"),
      line("┌──────────────────────┬──────────────┬──────────────┬──────────────┐"),
      segments([
        ["│ "],
        ["Package", "text-cyan-400"],
        ["              │ "],
        ["Current", "text-cyan-400"],
        ["      │ "],
        ["Latest", "text-cyan-400"],
        ["       │ "],
        ["Action", "text-cyan-400"],
        ["       │"],
      ]),
      line("├──────────────────────┼──────────────┼──────────────┼──────────────┤"),
      segments([
        ["│ lodash               │ "],
        ["4.17.0", "text-base-content/50"],
        ["       │ 4.17.21      │ "],
        ["Pinned ■", "text-warning"],
        ["     │"],
      ]),
      segments([
        ["│ fs-extra             │ "],
        ["10.0.0", "text-base-content/50"],
        ["       │ 10.1.0       │ "],
        ["Pinned ■", "text-warning"],
        ["     │"],
      ]),
      line("└──────────────────────┴──────────────┴──────────────┴──────────────┘"),
      line(""),
      line("codependence", "font-semibold text-cyan-400"),
      line("  🤼‍♀️  Found 2 dependency issues"),
      line("    1. lodash: found 4.17.0, expected 4.17.21"),
      line("    2. fs-extra: found 10.0.0, expected 10.1.0"),
      line(""),
      line("codependence", "font-semibold text-cyan-400"),
      line(
        "  🤼‍♀️  test-writeFileSync: /Users/jeffrywainwright/code/oss/codependence/tests/unit/fixtures/test-fail-package.json",
      ),
      line("codependence", "font-semibold text-cyan-400"),
      line("  🤼‍♀️  Dependencies were not correct but should be updated! Check your git status."),
    ],
  },
];

const pauseBetweenTabs = 4600;

export function SpotlightCode() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSnippet = snippets[activeIndex];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setStarted(true);
      },
      { threshold: 0.25 },
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;

    const timeout = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % snippets.length);
    }, pauseBetweenTabs);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, started]);

  const switchTab = (index: number) => {
    setActiveIndex(index);
    setStarted(true);
  };

  return (
    <div
      ref={containerRef}
      className="spotlight-frame w-full min-w-0 max-w-full"
    >
      <div className="terminal-window w-full">
        <div className="terminal-header terminal-header-with-tabs">
          <div className="flex items-center gap-2">
            <span className="terminal-dot terminal-dot-red" aria-hidden="true" />
            <span className="terminal-dot terminal-dot-yellow" aria-hidden="true" />
            <span className="terminal-dot terminal-dot-green" aria-hidden="true" />
            <span className="ml-3 hidden text-xs text-slate-400 sm:inline">terminal</span>
          </div>
          <div className="terminal-tabs">
            {snippets.map((snippet, index) => (
              <button
                key={snippet.id}
                type="button"
                onClick={() => switchTab(index)}
                aria-pressed={activeIndex === index}
                className={activeIndex === index ? "terminal-tab active" : "terminal-tab"}
              >
                {snippet.title}
              </button>
            ))}
          </div>
        </div>

        <div className="terminal-content max-h-[420px] min-h-[300px]">
          <pre className="w-max whitespace-pre">
            {renderTerminal(activeSnippet)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function renderTerminal(snippet: (typeof snippets)[number]) {
  const rendered: ReactNode[] = [];

  rendered.push(
    <span key="prompt" className="text-base-content/50">
      $
    </span>,
    <span key="prompt-space"> </span>,
    <span key="command" className="text-base-content">
      {snippet.command}
    </span>,
  );

  if (snippet.output.length > 0) {
    rendered.push(<span key="command-gap">{"\n\n"}</span>);
  }

  snippet.output.forEach((lineSegments, lineIndex) => {
    lineSegments.segments.forEach(({ text, className }, segmentIndex) => {
      rendered.push(
        <span
          key={`${lineIndex}-${segmentIndex}`}
          className={className || "text-base-content"}
        >
          {text}
        </span>,
      );
    });

    if (lineIndex < snippet.output.length - 1) {
      rendered.push(<span key={`${lineIndex}-line-break`}>{"\n"}</span>);
    }
  });

  return rendered;
}

function line(text: string, className?: string): TranscriptLine {
  return segmentsList([[text, className]]);
}

function cliHeader(text: string): TranscriptLine {
  return segmentsList([
    ["◆", "text-cyan-400"],
    [` ${text}`],
  ]);
}

function segments(entries: Array<[text: string, className?: string]>): TranscriptLine {
  return segmentsList(entries);
}

function segmentsList(entries: Array<[text: string, className?: string]>): TranscriptLine {
  return {
    segments: entries.map(([text, className]) => ({
      text,
      ...(className ? { className } : {}),
    })),
  };
}
