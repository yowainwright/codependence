import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Braces,
  FileJson2,
  GitCompareArrows,
  GitPullRequestArrow,
  ShieldCheck,
} from "lucide-react";

type Feature = {
  title: string;
  description: string;
  Icon: LucideIcon;
};

const features: Feature[] = [
  {
    title: "Policy Drift",
    description:
      "Compare manifest versions against pinned policy and show exactly which packages moved.",
    Icon: GitCompareArrows,
  },
  {
    title: "Version Control",
    description:
      "Keep selected dependencies fixed while update mode applies allowed changes.",
    Icon: ShieldCheck,
  },
  {
    title: "Monorepo Policy",
    description:
      "Resolve root and package policy across workspaces without flattening every package.",
    Icon: Boxes,
  },
  {
    title: "Node API",
    description:
      "Call the same check engine from release scripts, bots, or repository tooling.",
    Icon: Braces,
  },
  {
    title: "CI Action Output",
    description:
      "Fail jobs when policy drifts, or update manifests before opening a dependency PR.",
    Icon: GitPullRequestArrow,
  },
  {
    title: "Structured Output",
    description:
      "Emit JSON or Markdown for PR comments, audit logs, and automation summaries.",
    Icon: FileJson2,
  },
];

export function FeatureShowcase() {
  return (
    <section className="border-b border-base-content/10 bg-base-200/35 px-4 py-14 sm:px-6 lg:px-10 xl:px-16">
      <div className="mx-auto max-w-[88rem]">
        <header className="max-w-3xl">
          <h2 className="text-3xl font-black sm:text-4xl">
            Dependency policy without a new release process
          </h2>
          <p className="mt-4 text-lg leading-8 text-base-content/75">
            Codependence gives repository automation a clear contract: what
            should stay pinned, what can move, and what changed.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-base-content/10 bg-base-content/10 md:grid-cols-2 xl:grid-cols-3">
          {features.map(({ title, description, Icon }) => (
            <article
              key={title}
              className="flex min-h-40 gap-4 bg-base-100 p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-base-content/10 bg-base-200 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-base-content/70">
                  {description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
