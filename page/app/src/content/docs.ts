import type { DocMeta } from "@/types";

const INTRODUCTION_DESCRIPTION =
  "Codependence updates your project's dependencies. Apply updates locally or use the GitHub Action to open a pull request on a schedule.";
const SUPPORTED_LANGUAGES_DESCRIPTION =
  "Find your dependency manager and try an update with Python, Go, or Rust.";
const WHY_USE_DESCRIPTION = "Choose which dependencies to update and review the changes locally or in a pull request.";
const WHY_NOT_USE_DESCRIPTION =
  "Reasons why Codependence might not be the right choice for your project.";

export const DOCS: DocMeta[] = [
  {
    slug: "introduction",
    title: "Introduction",
    description: INTRODUCTION_DESCRIPTION,
  },
  {
    slug: "cli",
    title: "CLI",
    description: "Run a dependency check, choose which files to update, and configure the CLI.",
  },
  {
    slug: "node",
    title: "Node",
    description: "Check a manifest from Node, inspect proposed edits, and apply a dependency policy.",
  },
  {
    slug: "github-action",
    title: "GitHub Action",
    description: "Create small dependency update pull requests by manager.",
  },
  {
    slug: "usage",
    title: "Examples",
    description: "Reproduce a failing npm dependency check and update a Docker base image.",
  },
  {
    slug: "supported-languages",
    title: "Supported languages",
    description: SUPPORTED_LANGUAGES_DESCRIPTION,
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
