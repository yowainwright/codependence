import SpotlightCode from "./SpotlightCode";
import { resolveDocsUrl } from "@/utils/urlResolver";

const GITHUB_URL = "https://github.com/yowainwright/codependence";

function CodeBlockActions() {
  return (
    <div className="flex gap-4 mt-8">
      <a href={resolveDocsUrl("introduction")} className="btn rounded-lg border-none bg-primary text-primary-content hover:bg-primary/80">
        Get Started
      </a>
      <a href={GITHUB_URL} className="btn btn-outline rounded-lg border-none">
        View on GitHub
      </a>
    </div>
  );
}

function CodeBlockCopy() {
  return (
    <div className="xl:max-w-lg flex flex-col justify-center font-sans">
      <h1 className="text-4xl lg:text-5xl font-black">
        Keep Versions <span className="text-primary">Intentional</span>
      </h1>
      <p className="mt-8 text-lg">
        Codependence gives your project a small, explicit policy for dependency versions. Check only the
        packages you care about, or pin selected packages while the rest move forward.
      </p>
      <CodeBlockActions />
    </div>
  );
}

export function CodeBlock() {
  return (
    <div className="flex justify-center py-20 lg:py-28">
      <div className="xl:flex gap-16 max-w-6xl">
        <CodeBlockCopy />
        <SpotlightCode />
      </div>
    </div>
  );
}
