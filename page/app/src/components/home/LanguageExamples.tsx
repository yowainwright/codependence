import type { ReactNode } from "react";

type TerminalSegment = {
  text: string;
  className?: string;
};

type TerminalLine = TerminalSegment[];

const pythonLines: TerminalLine[] = [
  shell("codependence --language python --files requirements.txt --update --dryRun"),
  blank(),
  header("Dependencies that would be updated:"),
  plain("┌──────────────────────┬──────────────┬──────────────┬──────────────┐"),
  row([
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
  plain("├──────────────────────┼──────────────┼──────────────┼──────────────┤"),
  row([
    ["│ requests             │ "],
    ["==2.28.0", "text-base-content/50"],
    ["     │ ==2.31.0     │ "],
    ["Pinned ■", "text-warning"],
    ["     │"],
  ]),
  plain("└──────────────────────┴──────────────┴──────────────┴──────────────┘"),
  blank(),
  infoPrefix(),
  plain("  🤼‍♀️  Found 1 dependency issue"),
  plain("    1. requests: found ==2.28.0, expected ==2.31.0"),
];

const goLines: TerminalLine[] = [
  shell("codependence --language go --files go.mod --update --dryRun"),
  blank(),
  header("Dependencies that would be updated:"),
  plain("┌──────────────────────┬──────────────┬──────────────┬──────────────┐"),
  row([
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
  plain("├──────────────────────┼──────────────┼──────────────┼──────────────┤"),
  row([
    ["│ github.com/lib/pq    │ "],
    ["v1.10.0", "text-base-content/50"],
    ["      │ v1.10.9      │ "],
    ["Pinned ■", "text-warning"],
    ["     │"],
  ]),
  row([
    ["│ golang.org/x/crypto  │ "],
    ["v0.10.0", "text-base-content/50"],
    ["      │ v0.11.0      │ "],
    ["Pinned ■", "text-warning"],
    ["     │"],
  ]),
  plain("└──────────────────────┴──────────────┴──────────────┴──────────────┘"),
  blank(),
  infoPrefix(),
  plain("  🤼‍♀️  Found 2 dependency issues"),
  plain("    1. github.com/lib/pq: found v1.10.0, expected v1.10.9"),
  plain("    2. golang.org/x/crypto: found v0.10.0, expected v0.11.0"),
];

export function LanguageExamples() {
  return (
    <section className="border-y border-base-content/10 bg-base-100 px-4 py-16 sm:px-6 lg:px-10 xl:px-16">
      <div className="mx-auto max-w-7xl">
        <header className="max-w-3xl">
          <h2 className="text-3xl font-black sm:text-5xl">
            Same flow for <span className="gradient-text">Go and Python</span>
          </h2>
          <p className="mt-5 text-lg leading-8 text-base-content/75">
            Codependence can run the check, dry-run, and update workflow against Python and Go
            manifests when a repo needs version policy beyond package.json.
          </p>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <LanguageTerminal title="Python requirements.txt" lines={pythonLines} />
          <LanguageTerminal title="Go modules" lines={goLines} />
        </div>
      </div>
    </section>
  );
}

function LanguageTerminal({ title, lines }: { title: string; lines: TerminalLine[] }) {
  return (
    <article className="spotlight-frame min-w-0">
      <div className="terminal-window">
        <div className="terminal-header">
          <span className="terminal-dot terminal-dot-red" aria-hidden="true" />
          <span className="terminal-dot terminal-dot-yellow" aria-hidden="true" />
          <span className="terminal-dot terminal-dot-green" aria-hidden="true" />
          <span className="ml-3 text-xs text-slate-400">{title}</span>
        </div>
        <div className="terminal-content max-h-[350px] min-h-[300px]">
          <pre className="w-max whitespace-pre">{renderLines(lines)}</pre>
        </div>
      </div>
    </article>
  );
}

function renderLines(lines: TerminalLine[]) {
  const rendered: ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    line.forEach(({ text, className }, segmentIndex) => {
      rendered.push(
        <span key={`${lineIndex}-${segmentIndex}`} className={className || "text-base-content"}>
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

function shell(command: string): TerminalLine {
  return [
    { text: "$", className: "text-base-content/50" },
    { text: " " },
    { text: command },
  ];
}

function header(text: string): TerminalLine {
  return [
    { text: "◆", className: "text-cyan-400" },
    { text: ` ${text}` },
  ];
}

function infoPrefix(): TerminalLine {
  return [{ text: "codependence", className: "font-semibold text-cyan-400" }];
}

function blank(): TerminalLine {
  return [{ text: "" }];
}

function plain(text: string): TerminalLine {
  return [{ text }];
}

function row(entries: Array<[text: string, className?: string]>): TerminalLine {
  return entries.map(([text, className]) => ({
    text,
    ...(className ? { className } : {}),
  }));
}
