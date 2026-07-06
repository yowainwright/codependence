import IntegrationTerminal from "./IntegrationTerminal";
import { resolveDocsUrl } from "@/utils/urlResolver";

function IntegrationCopy() {
  return (
    <div className="xl:max-w-lg flex flex-col justify-center font-sans">
      <h1 className="text-4xl lg:text-5xl font-black">
        Fits Your <span className="text-primary">Workflow</span>
      </h1>
      <p className="mt-8 text-lg">
        Codependence runs where you need policy enforcement: local terminals, package scripts, GitHub Actions, or other CI systems.
      </p>
      <p className="mt-4 text-lg">
        Use it to check drift, preview changes, update manifests, and produce structured output for automation.
      </p>
      <div className="flex gap-4 mt-8">
        <a href={resolveDocsUrl("introduction")} className="btn rounded-lg border-none bg-primary text-primary-content hover:bg-primary/80">
          Get Started
        </a>
        <a href={resolveDocsUrl("policy-surface")} className="btn btn-outline rounded-lg border-none">
          View Policy Surface
        </a>
      </div>
    </div>
  );
}

export function Integration() {
  return (
    <div className="flex justify-center py-20 lg:py-28">
      <div className="xl:flex gap-16 max-w-6xl">
        <IntegrationTerminal />
        <IntegrationCopy />
      </div>
    </div>
  );
}
