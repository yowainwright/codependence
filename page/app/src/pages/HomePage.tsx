import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { FeatureShowcase } from "@/components/home/FeatureShowcase";
import { LanguageExamples } from "@/components/home/LanguageExamples";
import { SpotlightCode } from "@/components/home/SpotlightCode";

const installCommand = "npm install --save-dev codependence";

export function HomePage() {
  return (
    <>
      <HeroSection />
      <FeatureShowcase />
      <WorkflowSection />
      <LanguageExamples />
      <InstallSection />
    </>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate flex min-h-[calc(100vh-68px)] items-start justify-center overflow-hidden px-4 pb-16 pt-6 md:px-8 md:pb-20 md:pt-8">
      <HeroBackground />
      <article className="relative z-10 w-full max-w-2xl md:max-w-5xl xl:max-w-7xl">
        <header className="mb-10 text-center md:mb-12">
          <img
            src={`${import.meta.env.BASE_URL}logos/codependence.svg`}
            alt="Codependence"
            className="mx-auto h-24 w-24 md:h-36 md:w-36"
          />
        </header>

        <div className="flex flex-col-reverse gap-10 lg:flex-row lg:items-center lg:justify-between xl:gap-12">
          <aside className="mt-6 w-full text-left lg:mt-0 lg:flex-[1.08]">
            <div className="mx-auto w-full max-w-3xl lg:mx-0 xl:max-w-[44rem]">
              <SpotlightCode />
            </div>
          </aside>

          <header className="text-center lg:max-w-xl lg:flex-[0.92] lg:text-left">
            <h1 className="mb-8 text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl md:text-5xl lg:text-[3.35rem]">
              <span className="font-bold gradient-text">Codependence</span> enforces dependency
              version policy across every repo and CI run
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-8 text-base-content/75 lg:mx-0">
              Keep package versions aligned, preview drift, and apply pinned policies with one CLI.
            </p>
            <nav className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:items-stretch sm:justify-center lg:justify-start">
              <Link
                to="/docs/$slug"
                params={{ slug: "introduction" }}
                className="btn btn-lg btn-primary rounded-2xl"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <figure className="flex h-12 w-full max-w-md items-center gap-3 rounded-2xl border border-base-content/10 bg-base-100/85 px-3 shadow-sm shadow-base-content/5 backdrop-blur sm:w-auto">
                <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-[0.95rem] font-medium">
                  {installCommand}
                </code>
                <CopyButton text={installCommand} />
              </figure>
            </nav>
          </header>
        </div>
      </article>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)] lg:px-10 xl:px-16">
      <SpotlightCode />
      <div className="flex flex-col justify-center">
        <h2 className="text-3xl font-black sm:text-5xl">
          Fits your <span className="gradient-text">workflow</span>
        </h2>
        <p className="mt-6 text-lg leading-8 text-base-content/75">
          Run checks in terminals, package scripts, GitHub Actions, or any CI system. Use dry runs
          to preview drift and update mode to apply policy intentionally.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/docs/$slug" params={{ slug: "cli" }} className="btn btn-primary rounded-2xl">
            CLI docs
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "policy-surface" }}
            className="btn btn-outline rounded-2xl"
          >
            Policy surface
          </Link>
        </div>
      </div>
    </section>
  );
}

function InstallSection() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
      <h2 className="text-3xl font-black sm:text-5xl">
        Install <span className="gradient-text">Codependence</span>
      </h2>
      <p className="mt-5 text-base-content/70">Get started with a dev dependency and one script.</p>
      <div className="mt-6 flex items-center rounded-lg border border-base-content/10 bg-base-200 text-left shadow-sm">
        <code className="min-w-0 flex-1 truncate px-4 py-3 text-sm">{installCommand}</code>
        <CopyButton text={installCommand} />
      </div>
      <Link
        to="/docs/$slug"
        params={{ slug: "introduction" }}
        className="btn btn-primary mt-7 rounded-2xl"
      >
        Read the docs
      </Link>
    </section>
  );
}

const BLOB_CLIP =
  "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 150%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)";

function HeroBackground() {
  return (
    <figure
      className="pointer-events-none absolute inset-0 z-0 transform-gpu overflow-hidden blur-3xl"
      aria-hidden="true"
    >
      <span
        className="hero-blob relative left-[calc(50%-11rem)] aspect-[1155/678] w-[40rem] -translate-x-1/2 rotate-[70deg] sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
        style={{ clipPath: BLOB_CLIP }}
      />
      <span
        className="hero-blob relative left-[calc(50%-11rem)] aspect-[1155/678] w-[40rem] -translate-x-1/2 rotate-[70deg] sm:left-[calc(100%)] sm:w-[72.1875rem]"
        style={{ clipPath: BLOB_CLIP }}
      />
    </figure>
  );
}
