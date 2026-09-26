import { CopyButton } from "@/components/common/CopyButton";
import { resolveDocsUrl } from "@/utils/urlResolver";
import { DEV_INSTALL_COMMAND } from "./constants";
import { Button } from "@/components/ui/button";

function InstallSnippet() {
  return (
    <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-raised shadow-sm">
      <code className="ml-4">{DEV_INSTALL_COMMAND}</code>
      <CopyButton text={DEV_INSTALL_COMMAND} />
    </div>
  );
}

export function Install() {
  return (
    <div className="mx-auto flex max-w-md justify-center py-28 text-foreground md:max-w-full">
      <div className="w-full text-center">
        <div className="w-full max-w-xl font-sans">
          <h1 className="text-2xl md:text-5xl font-bold">
            Install <span className="text-primary">Codependence</span>
          </h1>
          <p className="mt-5 w-full max-w-lg text-center">
            Get started with Codependence in seconds
          </p>
          <InstallSnippet />
          <Button
            render={<a href={resolveDocsUrl("introduction")} />}
            className="mt-7 h-12 rounded-lg px-6"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}
