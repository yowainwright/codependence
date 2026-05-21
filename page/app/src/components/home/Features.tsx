import {
  Gauge,
  Package,
  GitBranch,
  Terminal,
  RefreshCw,
  Search,
} from "lucide-react";

const features = [
  {
    title: "Policy Checks",
    description:
      "Compare manifests against the versions your project expects and fail when dependencies drift.",
    icon: Gauge,
  },
  {
    title: "Version Control",
    description:
      "Update only listed packages, or pin selected packages while updating everything else.",
    icon: Package,
  },
  {
    title: "Monorepo Policy",
    description:
      "Use root defaults and package-specific policies to keep workspace versions intentional.",
    icon: GitBranch,
  },
  {
    title: "CLI & API",
    description:
      "Run Codependence from the command line or integrate it into custom tooling with the Node.js API.",
    icon: Terminal,
  },
  {
    title: "CI Gates",
    description:
      "Use the same checks locally and in CI so version policy is enforced before merge.",
    icon: RefreshCw,
  },
  {
    title: "Structured Output",
    description:
      "Generate table, JSON, or Markdown reports for scripts, PR comments, and audits.",
    icon: Search,
  },
];

export default function Features() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 justify-items-center py-20 lg:py-28">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <div
            key={feature.title}
            className="card max-w-2xl bg-base-200 border border-base-content/10 hover:shadow-lg transition rounded-lg"
          >
            <div className="card-body font-sans">
              <div className="h-16 w-16 bg-base-300 rounded-full flex items-center justify-center">
                <Icon className="w-8 h-8 text-primary" />
              </div>
              <h2 className="card-title">{feature.title}</h2>
              <p>{feature.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
