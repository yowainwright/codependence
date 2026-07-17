import type { DocMeta, SearchResult } from "@/types";
import { resolveDocsUrl } from "@/utils/urlResolver";

const INTRODUCTION_DESCRIPTION =
  "Enforce dependency version policy locally, in CI, and across workspaces.";
const POLICY_SURFACE_DESCRIPTION =
  "What Codependence checks today and where version policy can expand next.";
const WHY_USE_DESCRIPTION =
  "Codependence enforces dependency version policy where your code runs.";
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

export const SEARCH_DATA: SearchResult[] = [
  {
    title: "Introduction",
    description: "Get started with Codependence",
    content:
      "Codependence enforces dependency version policy across local development, workspaces, and CI.",
    slug: "introduction",
  },
  {
    title: "CLI Usage",
    description: "Learn how to use the Codependence CLI",
    content:
      "The Codependence CLI checks, reports, and applies dependency version policy.",
    slug: "cli",
  },
  {
    title: "Options",
    description: "Configuration options for Codependence",
    content:
      "Customize Codependence behavior with various configuration options.",
    slug: "options",
  },
  {
    title: "Node.js API",
    description: "Using Codependence programmatically",
    content: "Integrate Codependence into custom Node.js policy tooling.",
    slug: "node",
  },
  {
    title: "Recipes",
    description: "Common use cases and examples",
    content: "Practical examples and common patterns for using Codependence.",
    slug: "recipes",
  },
  {
    title: "Policy Surface",
    description: "Current and planned version policy surfaces",
    content:
      "Understand what Codependence checks today and where version policy can expand next.",
    slug: "policy-surface",
  },
  {
    title: "Main Use Case",
    description: "Primary use cases for Codependence",
    content:
      "Use Codependence to keep important dependency versions intentional.",
    slug: "main-usecase",
  },
  {
    title: "Why Use Codependence",
    description: "Benefits of using Codependence",
    content: "Learn why Codependence is useful for version policy enforcement.",
    slug: "why-use-codependence",
  },
  {
    title: "Why Not Use Codependence",
    description: "When Codependence might not be the right tool",
    content: "Understanding the limitations and when to consider alternatives.",
    slug: "why-not-use-codependence",
  },
  {
    title: "Badges",
    description: "Display Codependence status badges",
    content:
      "Add status badges to your README to show Codependence compliance.",
    slug: "badges",
  },
  {
    title: "Synopsis",
    description: "Quick overview of Codependence",
    content: "A brief summary of Codependence dependency version policy.",
    slug: "synopsis",
  },
  {
    title: "Usage",
    description: "Detailed usage instructions",
    content:
      "Comprehensive guide to using Codependence in project policy checks.",
    slug: "usage",
  },
];

export const SIDEBAR = [
  {
    title: "Getting Started",
    items: [
      {
        title: "Introduction",
        href: resolveDocsUrl("introduction"),
      },
      {
        title: "Main Use Case",
        href: resolveDocsUrl("main-usecase"),
      },
    ],
  },

  {
    title: "Usage",
    items: [
      {
        title: "CLI",
        href: resolveDocsUrl("cli"),
      },
      {
        title: "Node.js",
        href: resolveDocsUrl("node"),
      },
      {
        title: "Options",
        href: resolveDocsUrl("options"),
      },
      {
        title: "Usage Examples",
        href: resolveDocsUrl("usage"),
      },
    ],
  },

  {
    title: "Advanced",
    items: [
      {
        title: "Policy Surface",
        href: resolveDocsUrl("policy-surface"),
      },
      {
        title: "Recipes",
        href: resolveDocsUrl("recipes"),
      },
    ],
  },
];
