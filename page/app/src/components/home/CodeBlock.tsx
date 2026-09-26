import SpotlightCode from "./SpotlightCode";
import { resolveDocsUrl } from "@/utils/urlResolver";
import { GITHUB_URL } from "@/constants";
import { Button } from "@/components/ui/button";

function CodeBlockActions() {
  return (
    <div className="flex gap-4 mt-8">
      <Button
        render={<a href={resolveDocsUrl("introduction")} />}
        className="h-12 rounded-lg px-6"
      >
        Get Started
      </Button>
      <Button
        variant="outline"
        render={<a href={GITHUB_URL} />}
        className="h-12 rounded-lg border-none px-6"
      >
        View on GitHub
      </Button>
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
        Codependence gives your project a small, explicit policy for dependency
        versions. Check only the packages you care about, or pin selected
        packages while the rest move forward.
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
