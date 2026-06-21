import type { ReactNode } from "react";

type Feature = {
  title: string;
  description: string;
  visual: ReactNode;
};

const features: Feature[] = [
  {
    title: "Policy Drift",
    description: "Compare manifest versions against pinned policy and show exactly which packages drifted.",
    visual: <PolicyVisual />,
  },
  {
    title: "Version Control",
    description: "Keep selected packages pinned while update mode applies the versions policy allows.",
    visual: <VersionControlVisual />,
  },
  {
    title: "Monorepo Policy",
    description: "Resolve root and package policy across workspaces without flattening every package to one rule.",
    visual: <MonorepoVisual />,
  },
  {
    title: "Node API",
    description: "Call the same check engine from release scripts, bots, or custom repository tooling.",
    visual: (
      <CodeVisual
        title="node-api.ts"
        lines={[
          'import { checkFiles } from "codependence";',
          "",
          "await checkFiles({",
          '  files: ["package.json"],',
          '  codependencies: [{ lodash: "4.17.21" }],',
          "});",
        ]}
      />
    ),
  },
  {
    title: "CI Action Output",
    description: "Run the same command in CI and fail the job when dependency policy drifts.",
    visual: (
      <CodeVisual
        title="GitHub Actions"
        lines={[
          "Run bunx codependence --format table",
          "◆ Dependency Updates Available:",
          "┌──────────────────────┬──────────────┐",
          "│ Package              │ Current      │",
          "├──────────────────────┼──────────────┤",
          "│ lodash               │ 4.17.0       │",
          "└──────────────────────┴──────────────┘",
          "codependence",
          "  🤼‍♀️  Found 2 dependency issues",
          "Error: Process completed with exit code 1.",
        ]}
      />
    ),
  },
  {
    title: "Structured Output",
    description: "Request JSON or Markdown when policy results need to feed PR comments and audit jobs.",
    visual: (
      <CodeVisual
        title="structured.json"
        lines={[
          "$ codependence --format json",
          "{",
          '  "summary": {',
          '    "total": 2,',
          '    "outdated": 2',
          "  },",
          '  "exitCode": 1',
          "}",
        ]}
      />
    ),
  },
];

export function FeatureShowcase() {
  return (
    <section className="border-y border-base-content/10 bg-base-200/35 px-4 py-16 sm:px-6 lg:px-10 xl:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="flex min-h-[350px] flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-100/90 shadow-sm shadow-base-content/5"
            >
              <figure className="flex h-52 items-center justify-center border-b border-base-content/10 bg-base-200/55 p-3">
                {feature.visual}
              </figure>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="text-lg font-semibold">{feature.title}</h2>
                <p className="mt-3 text-sm leading-6 text-base-content/70">
                  {feature.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PolicyVisual() {
  return (
    <svg viewBox="0 0 360 170" role="img" aria-label="Policy check animation" className="h-full w-full">
      <rect x="22" y="24" width="136" height="116" rx="8" className="fill-base-100 stroke-base-content/15" />
      <rect x="202" y="24" width="136" height="116" rx="8" className="fill-base-100 stroke-base-content/15" />
      <text x="42" y="51" className="fill-base-content/70 text-[13px] font-semibold">package.json</text>
      <text x="222" y="51" className="fill-base-content/70 text-[13px] font-semibold">policy</text>
      <text x="42" y="82" className="fill-base-content/60 text-[12px]">lodash 4.17.0</text>
      <text x="42" y="109" className="fill-base-content/60 text-[12px]">fs-extra 10.0.0</text>
      <text x="222" y="82" className="fill-base-content/60 text-[12px]">lodash 4.17.21</text>
      <text x="222" y="109" className="fill-base-content/60 text-[12px]">fs-extra 10.1.0</text>
      <path
        d="M164 82 C178 82 184 82 198 82"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-cyan-400"
        strokeDasharray="42"
      >
        <animate attributeName="stroke-dashoffset" values="42;0;0" dur="3.4s" repeatCount="indefinite" />
      </path>
      <path
        d="M164 109 C178 109 184 109 198 109"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-cyan-400"
        strokeDasharray="42"
      >
        <animate attributeName="stroke-dashoffset" values="42;0;0" dur="3.4s" begin=".4s" repeatCount="indefinite" />
      </path>
      <circle cx="183" cy="82" r="5" className="fill-error">
        <animate attributeName="opacity" values=".35;1;.35" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="183" cy="109" r="5" className="fill-error">
        <animate attributeName="opacity" values=".35;1;.35" dur="1.8s" begin=".35s" repeatCount="indefinite" />
      </circle>
      <text x="144" y="151" className="fill-error text-[12px] font-semibold">drift detected</text>
    </svg>
  );
}

function VersionControlVisual() {
  return (
    <svg viewBox="0 0 360 170" role="img" aria-label="Version control animation" className="h-full w-full">
      <rect x="28" y="34" width="304" height="102" rx="10" className="fill-base-100 stroke-base-content/15" />
      <text x="48" y="65" className="fill-base-content/70 text-[13px] font-semibold">controlled update</text>
      <rect x="48" y="84" width="86" height="30" rx="15" className="fill-base-200 stroke-base-content/10" />
      <text x="64" y="104" className="fill-base-content/70 text-[12px]">4.17.0</text>
      <path d="M148 99 H212" className="stroke-cyan-400" strokeWidth="3" strokeLinecap="round" />
      <path d="M203 91 L214 99 L203 107" className="stroke-cyan-400" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle r="5" className="fill-cyan-400">
        <animateMotion dur="2.6s" repeatCount="indefinite" path="M148 99 H208" />
      </circle>
      <rect x="226" y="84" width="86" height="30" rx="15" className="fill-base-200 stroke-base-content/10" />
      <text x="241" y="104" className="fill-base-content/70 text-[12px]">4.17.21</text>
      <text x="127" y="128" className="fill-warning text-[12px] font-semibold">Pinned ■</text>
    </svg>
  );
}

function MonorepoVisual() {
  return (
    <svg viewBox="0 0 360 170" role="img" aria-label="Monorepo policy animation" className="h-full w-full">
      <g className="stroke-base-content/20" strokeWidth="2">
        <path d="M180 60 L86 118" />
        <path d="M180 60 L180 118" />
        <path d="M180 60 L274 118" />
      </g>
      <g>
        <circle cx="180" cy="56" r="28" className="fill-base-100 stroke-cyan-400" strokeWidth="2" />
        <text x="160" y="61" className="fill-base-content/70 text-[12px] font-semibold">root</text>
      </g>
      {[
        [86, 120, "api"],
        [180, 120, "web"],
        [274, 120, "cli"],
      ].map(([cx, cy, label], index) => (
        <g key={label}>
          <circle cx={cx} cy={cy} r="24" className="fill-base-100 stroke-base-content/15" strokeWidth="2" />
          <circle cx={cx} cy={cy} r="28" className="fill-cyan-400/20">
            <animate attributeName="r" values="24;31;24" dur="2.4s" begin={`${index * 0.35}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values=".6;.12;.6" dur="2.4s" begin={`${index * 0.35}s`} repeatCount="indefinite" />
          </circle>
          <text x={Number(cx) - 12} y={Number(cy) + 5} className="fill-base-content/70 text-[12px] font-semibold">
            {label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function CodeVisual({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="h-full w-full overflow-hidden rounded-md border border-slate-800 bg-slate-950 shadow-inner">
      <div className="border-b border-slate-800 bg-slate-900 px-3 py-1.5 font-mono text-[0.65rem] text-slate-400">
        {title}
      </div>
      <pre className="overflow-hidden p-3 text-[0.68rem] leading-5 text-slate-100">
        {lines.map((line, index) => (
          <span key={`${line}-${index}`} className="block whitespace-pre">
            {line || " "}
          </span>
        ))}
      </pre>
    </div>
  );
}
