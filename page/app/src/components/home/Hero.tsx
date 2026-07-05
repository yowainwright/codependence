import { CopyButton } from "@/components/common/CopyButton";
import { ArrowRightIcon, ChevronRightIcon } from "@/components/common/Icons";
import { resolveUrl, resolveDocsUrl } from "@/utils/urlResolver";

const INSTALL_CMD = "npm install codependence";
const CLIP_PATH = "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 150%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)";

function HeroBackground() {
  return (
    <div className="absolute inset-x-0 top-50 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
      <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[40rem] -translate-x-1/2 rotate-[70deg] bg-gradient-to-tr from-primary to-accent opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" style={{ clipPath: CLIP_PATH }} />
      <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[40rem] -translate-x-1/2 rotate-[70deg] bg-gradient-to-tr from-secondary to-accent opacity-15 sm:left-[calc(100%)] sm:w-[72.1875rem]" style={{ clipPath: CLIP_PATH }} />
    </div>
  );
}

function InstallSnippet() {
  return (
    <div className="flex items-center bg-base-300 rounded-lg shadow-sm justify-between">
      <ChevronRightIcon className="ml-4 mr-2 w-4 h-4" />
      <code className="flex-1 text-left leading-none mr-4">{INSTALL_CMD}</code>
      <CopyButton />
    </div>
  );
}

function HeroActions() {
  return (
    <div className="flex sm:flex-row flex-col justify-center items-center gap-5">
      <a href={resolveDocsUrl("introduction")}>
        <button className="btn bg-primary text-primary-content hover:bg-primary/80 rounded-lg border-none">
          Get Started
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </a>
      <InstallSnippet />
    </div>
  );
}

export function Hero() {
  return (
    <div className="hero">
      <HeroBackground />
      <div className="hero-content text-center min-h-[40rem] font-sans">
        <div className="max-w-2xl md:max-w-6xl">
          <div className="flex justify-center mb-8">
            <img src={resolveUrl("logos/codependence.svg")} alt="Codependence Logo" className="w-32 h-32 md:w-40 md:h-40" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-7xl">
            Enforce your
            <br />
            <span className="text-primary font-bold">version policy</span>
          </h1>
          <div className="flex justify-center items-center">
            <p className="py-7 max-w-4xl text-md md:text-xl lg:text-2xl">
              Codependence keeps dependency versions intentional across local development, monorepos, and CI.
            </p>
          </div>
          <HeroActions />
        </div>
      </div>
    </div>
  );
}
