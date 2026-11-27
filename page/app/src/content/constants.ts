import type { SearchResult } from "@/types";
import { resolveDocsUrl } from "@/utils/urlResolver";

export { DOCS } from "./docs";

export const SEARCH_DATA: SearchResult[] = [
  {
    title: "Introduction",
    description: "Check and update dependency versions",
    content:
      "Pin lodash and preview updates to the other packages and Docker images. Review the changes in one pull request.",
    slug: "introduction",
  },
  {
    title: "CLI",
    description: "Commands, flags, and .codependencerc configuration",
    content: "Select files and manager targets, set version rules, preview updates, or save a report.",
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
    title: "Node",
    description: "Check, inspect, and update manifests from a Node script",
    content: "Use checkFiles to handle mismatches, inspect version diffs, and apply updates.",
    slug: "node",
  },
  {
    title: "Recipes",
    description: "Common use cases and examples",
    content: "Check pnpm and Go manifests, match packages by name, or save a JSON report.",
    slug: "recipes",
  },
  {
    title: "Supported languages",
    description: "Supported files and dependency managers",
    content: "Find supported files and try Python requirements.txt, Go go.mod, and Rust Cargo.toml update examples.",
    slug: "supported-languages",
  },
  {
    title: "Why Use Codependence",
    description: "Benefits of using Codependence",
    content: "Choose which packages to update in each workspace and review changes in a pull request.",
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
    content: "Preview and apply dependency updates from the CLI or schedule them with GitHub Actions.",
    slug: "synopsis",
  },
  {
    title: "Examples",
    description: "Check an npm dependency and update a Docker base image",
    content: "Run the lodash and Alpine examples from the first check through the final update.",
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
        title: "Node.js API",
        href: resolveDocsUrl("node"),
      },
      {
        title: "GitHub Action",
        href: resolveDocsUrl("github-action"),
      },
      {
        title: "Usage Examples",
        href: resolveDocsUrl("usage"),
      },
      {
        title: "Supported languages",
        href: resolveDocsUrl("supported-languages"),
      },
      {
        title: "Recipes",
        href: resolveDocsUrl("recipes"),
      },
    ],
  },
];
