import { 
  FiZap, 
  FiPackage, 
  FiGitBranch, 
  FiTerminal, 
  FiRefreshCw, 
  FiAlertCircle 
} from 'react-icons/fi';

const features = [
  {
    title: "Lightning Fast",
    description: "Quickly scan your entire project for dependency issues in seconds. Optimized for performance even in large monorepos.",
    icon: FiZap,
  },
  {
    title: "Dependency Management",
    description: "Automatically detect outdated, unused, or mismatched dependencies across multiple package.json files in your project.",
    icon: FiPackage,
  },
  {
    title: "Monorepo Support",
    description: "Built for modern development workflows. Works seamlessly with monorepos, ensuring consistency across all packages.",
    icon: FiGitBranch,
  },
  {
    title: "CLI & API",
    description: "Use codependence from the command line or integrate it into your build process with our flexible Node.js API.",
    icon: FiTerminal,
  },
  {
    title: "CI/CD Integration",
    description: "Easily integrate with GitHub Actions, GitLab CI, or any CI/CD pipeline to ensure dependency integrity on every commit.",
    icon: FiRefreshCw,
  },
  {
    title: "Smart Detection",
    description: "Intelligently identifies circular dependencies, version conflicts, and unused packages that could impact your project.",
    icon: FiAlertCircle,
  },
];

export default function Features() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 justify-items-center py-20 lg:py-28">
      {features.map((feature) => {
        const Icon = feature.icon;
        return (
          <div key={feature.title} className="card max-w-2xl bg-gradient-to-t from-base-100 to-base-300/50 border border-base-content/20 hover:border-base-content/40 transition">
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