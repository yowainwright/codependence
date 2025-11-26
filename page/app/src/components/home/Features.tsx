import {
  Gauge,
  Package,
  GitBranch,
  Terminal,
  RefreshCw,
  Search
} from 'lucide-react';

const features = [
  {
    title: "Efficient Scanning",
    description: "Scan your entire project for dependency issues in seconds. Optimized for performance even in large monorepos.",
    icon: Gauge,
  },
  {
    title: "Dependency Control",
    description: "Detect outdated, unused, or mismatched dependencies across multiple package.json files in your project.",
    icon: Package,
  },
  {
    title: "Monorepo Ready",
    description: "Built for modern development workflows. Works with monorepos, ensuring consistency across all packages.",
    icon: GitBranch,
  },
  {
    title: "CLI & API",
    description: "Use codependence from the command line or integrate it into your build process with the Node.js API.",
    icon: Terminal,
  },
  {
    title: "CI/CD Integration",
    description: "Integrate with GitHub Actions, GitLab CI, or any CI/CD pipeline to ensure dependency integrity on every commit.",
    icon: RefreshCw,
  },
  {
    title: "Version Detection",
    description: "Identifies version conflicts, outdated packages, and dependency mismatches that could impact your project.",
    icon: Search,
  },
];

export default function Features() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 justify-items-center py-20 lg:py-28">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <div key={feature.title} className="card max-w-2xl bg-base-200 border border-base-content/10 hover:shadow-lg transition rounded-lg">
            <div className="card-body font-outfit">
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