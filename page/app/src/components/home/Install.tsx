import { CopyButton } from "@/components/common/CopyButton";
import { resolveDocsUrl } from "@/utils/urlResolver";

const INSTALL_CMD = "npm install --save-dev codependence";

function InstallSnippet() {
  return (
    <div className="flex items-center bg-base-300 rounded-lg shadow-sm mt-4 justify-between">
      <code className="ml-4">{INSTALL_CMD}</code>
      <CopyButton text={INSTALL_CMD} />
    </div>
  );
}

export function Install() {
  return (
    <div className="hero bg-transparent text-base-content mx-auto py-28 max-w-md md:max-w-full">
      <div className="hero-content text-center">
        <div className="w-full max-w-xl font-sans">
          <h1 className="text-2xl md:text-5xl font-bold">
            Install <span className="text-primary">Codependence</span>
          </h1>
          <p className="mt-5 w-full max-w-lg text-center">
            Get started with Codependence in seconds
          </p>
          <InstallSnippet />
          <a href={resolveDocsUrl("introduction")}>
            <button className="btn btn-primary mt-7 rounded-lg border-none">Get Started</button>
          </a>
        </div>
      </div>
    </div>
  );
}
