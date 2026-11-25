import type { SearchResult } from "@/types";
import { resolveDocsUrl } from "@/utils/urlResolver";

export { DOCS } from "./docs";

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
    content: "The Codependence CLI checks, reports, and applies dependency version policy.",
    slug: "cli",
  },
  {
    title: "GitHub Action",
    description: "Create targeted dependency pull requests",
    content:
      "Run Bun, Go, uv, Docker, GitHub Actions, and Helm updates on separate schedules and stable pull request branches.",
    slug: "github-action",
  },
  {
    title: "Options",
    description: "Configuration options for Codependence",
    content: "Customize Codependence behavior with various configuration options.",
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
    content: "Understand what Codependence checks today and where version policy can expand next.",
    slug: "policy-surface",
  },
  {
    title: "Main Use Case",
    description: "Primary use cases for Codependence",
    content: "Use Codependence to keep important dependency versions intentional.",
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
    content: "Add status badges to your README to show Codependence compliance.",
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
    content: "Comprehensive guide to using Codependence in project policy checks.",
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
        title: "GitHub Action",
        href: resolveDocsUrl("github-action"),
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
