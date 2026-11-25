import type { DocMeta } from "@/types";

const INTRODUCTION_DESCRIPTION =
  "Enforce dependency version policy locally, in CI, and across workspaces.";
const POLICY_SURFACE_DESCRIPTION =
  "What Codependence checks today and where version policy can expand next.";
const WHY_USE_DESCRIPTION = "Codependence enforces dependency version policy where your code runs.";
const WHY_NOT_USE_DESCRIPTION =
  "Reasons why Codependence might not be the right choice for your project.";

export const DOCS: DocMeta[] = [
  {
    slug: "introduction",
    title: "Introduction",
    description: INTRODUCTION_DESCRIPTION,
  },
  {
    slug: "main-usecase",
    title: "Main Use Case",
    description: "Keep important versions intentional",
  },
  {
    slug: "cli",
    title: "CLI",
    description: "Command Line Interface for Codependence",
  },
  {
    slug: "github-action",
    title: "GitHub Action",
    description: "Create small dependency update pull requests by manager.",
  },
  {
    slug: "node",
    title: "Codependence in Node",
    description: "How to use Codependence as a Node.js utility.",
  },
  {
    slug: "options",
    title: "Codependence Options",
    description: "Configuration options for Codependence.",
  },
  {
    slug: "usage",
    title: "Usage",
    description: "How to use Codependence",
  },
  {
    slug: "policy-surface",
    title: "Policy Surface",
    description: POLICY_SURFACE_DESCRIPTION,
  },
  {
    slug: "recipes",
    title: "Recipes",
    description: "Common patterns and usage examples for Codependence.",
  },
  {
    slug: "synopsis",
    title: "Synopsis",
    description: "A summary of Codependence",
  },
  {
    slug: "why-use-codependence",
    title: "Why use Codependence?",
    description: WHY_USE_DESCRIPTION,
  },
  {
    slug: "why-not-use-codependence",
    title: "Why not use Codependence?",
    description: WHY_NOT_USE_DESCRIPTION,
  },
  {
    slug: "badges",
    title: "Badges",
    description: "A collection of badges related to the project.",
  },
];
