import type { ComponentType } from "react";

interface DocMeta {
  slug: string;
  title: string;
  description: string;
}

export type DocComponent = ComponentType<{
  components?: Record<string, ComponentType>;
}>;

type DocModule = {
  default: DocComponent;
};

const docModules = import.meta.glob<DocModule>("./docs/*.mdx");

const rawDocModules = import.meta.glob("./docs/*.mdx", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

export const docs: DocMeta[] = [
  {
    slug: "introduction",
    title: "Introduction",
    description: "Enforce dependency version policy locally, in CI, and across workspaces.",
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
    description: "What Codependence checks today and where version policy can expand next.",
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
    description: "Codependence enforces dependency version policy where your code runs.",
  },
  {
    slug: "why-not-use-codependence",
    title: "Why not use Codependence?",
    description: "Reasons why Codependence might not be the right choice for your project.",
  },
  {
    slug: "badges",
    title: "Badges",
    description: "A collection of badges related to the project.",
  },
];

export function getDocBySlug(slug: string): DocMeta | undefined {
  return docs.find((doc) => doc.slug === slug);
}

export async function getDocContent(slug: string): Promise<string | undefined> {
  const p = `./docs/${slug}.mdx`;
  return rawDocModules[p]?.();
}

export async function getDocComponent(slug: string): Promise<DocComponent | undefined> {
  const p = `./docs/${slug}.mdx`;
  const mod = await docModules[p]?.();
  return mod?.default;
}

export function getAllDocs(): DocMeta[] {
  return docs;
}
