import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  GitPullRequestArrow,
  ShieldCheck,
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import { FeatureShowcase } from "@/components/home/FeatureShowcase";
import { LanguageExamples } from "@/components/home/LanguageExamples";
import { SpotlightCode } from "@/components/home/SpotlightCode";

const installCommand = "npm install --save-dev codependence";
const heroHighlights = [
  {
    label: "Policy",
    value: "Pinned packages stay pinned",
    Icon: ShieldCheck,
  },
  {
    label: "Review",
    value: "Dry runs show exact drift",
    Icon: CheckCircle2,
  },
  {
    label: "Automation",
    value: "CI can update and open PRs",
    Icon: GitPullRequestArrow,
  },
];

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
    <section className="border-b border-base-content/10 bg-base-100 px-4 py-12 sm:px-6 md:py-14 lg:px-10">
      <article className="mx-auto grid min-w-0 max-w-[88rem] gap-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(34rem,1.12fr)] lg:items-center">
        <header className="min-w-0 max-w-2xl">
          <div className="mb-5 flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}logos/codependence.svg`}
              alt=""
              className="h-12 w-12"
            />
            <span className="text-sm font-semibold uppercase text-base-content/60">
              Dependency policy for active repos
            </span>
          </div>
          <h1 className="text-[2.65rem] font-black leading-none sm:text-6xl lg:text-7xl">
            <span className="gradient-text">Codependence</span>
          </h1>
          <p className="mt-6 max-w-xl text-xl leading-8 text-base-content/75">
            Keep package versions aligned, preview drift, and apply pinned
            dependency policy from the CLI or CI.
          </p>
          <nav className="mt-8 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/docs/$slug"
              params={{ slug: "introduction" }}
              className="btn btn-lg btn-primary w-full justify-center rounded-lg sm:w-auto"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <figure className="flex h-12 w-full min-w-0 items-center gap-3 rounded-lg border border-base-content/10 bg-base-200/70 px-3 shadow-sm sm:w-[26rem]">
              <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-[0.95rem] font-medium">
                {installCommand}
              </code>
              <CopyButton text={installCommand} />
            </figure>
          </nav>

          <dl className="mt-8 grid gap-3 sm:grid-cols-3">
            {heroHighlights.map(({ label, value, Icon }) => (
              <div
                key={label}
                className="rounded-lg border border-base-content/10 bg-base-200/50 p-4"
              >
                <dt className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </dt>
                <dd className="mt-2 text-sm leading-5 text-base-content/70">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="w-full min-w-0">
          <div className="mx-auto w-full max-w-3xl lg:max-w-none">
            <SpotlightCode />
          </div>
        </div>
      </article>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section className="mx-auto grid max-w-[88rem] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,42rem)_minmax(320px,1fr)] lg:px-10 xl:px-16">
      <SpotlightCode />
      <div className="flex flex-col justify-center">
        <h2 className="text-3xl font-black sm:text-4xl">
          Fits your <span className="gradient-text">workflow</span>
        </h2>
        <p className="mt-6 text-lg leading-8 text-base-content/75">
          Run checks in terminals, package scripts, GitHub Actions, or any CI
          system. Use dry runs to preview drift and update mode to apply policy
          intentionally.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            to="/docs/$slug"
            params={{ slug: "cli" }}
            className="btn btn-primary rounded-lg"
          >
            CLI docs
          </Link>
          <Link
            to="/docs/$slug"
            params={{ slug: "policy-surface" }}
            className="btn btn-outline rounded-lg"
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
    <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <h2 className="text-3xl font-black sm:text-4xl">
        Install <span className="gradient-text">Codependence</span>
      </h2>
      <p className="mt-5 text-base-content/70">
        Get started with a dev dependency and one script.
      </p>
      <div className="mt-6 flex items-center rounded-lg border border-base-content/10 bg-base-200 text-left shadow-sm">
        <code className="min-w-0 flex-1 truncate px-4 py-3 text-sm">
          {installCommand}
        </code>
        <CopyButton text={installCommand} />
      </div>
      <Link
        to="/docs/$slug"
        params={{ slug: "introduction" }}
        className="btn btn-primary mt-7 rounded-lg"
      >
        Read the docs
      </Link>
    </section>
  );
}
