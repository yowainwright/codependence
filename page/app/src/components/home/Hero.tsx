import { CopyButton } from "@/components/common/CopyButton";
import { ArrowRightIcon, ChevronRightIcon } from "@/components/common/Icons";
import { resolveUrl } from "@/utils/urlResolver";
import { HERO_CLIP_PATH, HERO_INSTALL_COMMAND } from "./constants";
import { Button } from "@/components/ui/button";

function HeroBackground() {
  return (
    <div
      className="absolute inset-x-0 top-50 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
      aria-hidden="true"
    >
      <div
        className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[40rem] -translate-x-1/2 rotate-[70deg] bg-gradient-to-tr from-primary to-accent opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        style={{ clipPath: HERO_CLIP_PATH }}
      />
      <div
        className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[40rem] -translate-x-1/2 rotate-[70deg] bg-gradient-to-tr from-secondary to-accent opacity-15 sm:left-[calc(100%)] sm:w-[72.1875rem]"
        style={{ clipPath: HERO_CLIP_PATH }}
      />
    </div>
  );
}

function InstallSnippet() {
  return (
    <div className="flex items-center justify-between rounded-lg bg-surface-raised shadow-sm">
      <ChevronRightIcon className="ml-4 mr-2 w-4 h-4" />
      <code className="flex-1 text-left leading-none mr-4">
        {HERO_INSTALL_COMMAND}
      </code>
      <CopyButton />
    </div>
  );
}

function HeroActions() {
  return (
    <div className="flex sm:flex-row flex-col justify-center items-center gap-5">
      <Button
        render={<a href="#onboarding" />}
        className="h-12 rounded-lg px-6"
      >
        Onboard a project
        <ArrowRightIcon className="w-4 h-4" />
      </Button>
      <InstallSnippet />
    </div>
  );
}

export function Hero() {
  return (
    <div className="relative flex w-full items-center justify-center">
      <HeroBackground />
      <div className="flex min-h-[40rem] w-full items-center justify-center px-4 text-center font-sans">
        <div className="max-w-2xl md:max-w-6xl">
          <div className="flex justify-center mb-8">
            <img
              src={resolveUrl("logos/codependence.svg")}
              alt="Codependence Logo"
              className="w-32 h-32 md:w-40 md:h-40"
            />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-7xl">
            Enforce your
            <br />
            <span className="text-primary font-bold">version policy</span>
          </h1>
          <div className="flex justify-center items-center">
            <p className="py-7 max-w-4xl text-md md:text-xl lg:text-2xl">
              Codependence keeps dependency versions intentional across local
              development, monorepos, and CI.
            </p>
          </div>
          <HeroActions />
        </div>
      </div>
    </div>
  );
}
