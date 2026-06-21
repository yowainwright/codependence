import type { ComponentType } from "react";
import { Effect } from "effect";
import { extractHeadings, type Heading } from "@/lib/mdx";

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
  section: "Getting Started" | "Usage" | "Reference" | "Project";
}

export type DocComponent = ComponentType<{
  components?: Record<string, ComponentType>;
}>;

type DocModule = {
  default: DocComponent;
};

export interface LoadedDoc {
  doc: DocMeta;
  Content: DocComponent;
  headings: Heading[];
  source: string;
}

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
    section: "Getting Started",
  },
  {
    slug: "main-usecase",
    title: "Main Use Case",
    description: "Keep important versions intentional.",
    section: "Getting Started",
  },
  {
    slug: "cli",
    title: "CLI",
    description: "Command Line Interface for Codependence.",
    section: "Usage",
  },
  {
    slug: "node",
    title: "Codependence in Node",
    description: "Use Codependence as a Node.js utility.",
    section: "Usage",
  },
  {
    slug: "options",
    title: "Codependence Options",
    description: "Configuration options for Codependence.",
    section: "Usage",
  },
  {
    slug: "usage",
    title: "Usage",
    description: "How to use Codependence.",
    section: "Usage",
  },
  {
    slug: "policy-surface",
    title: "Policy Surface",
    description: "What Codependence checks today and where version policy can expand next.",
    section: "Reference",
  },
  {
    slug: "recipes",
    title: "Recipes",
    description: "Common patterns and usage examples for Codependence.",
    section: "Reference",
  },
  {
    slug: "badges",
    title: "Badges",
    description: "A collection of badges related to the project.",
    section: "Project",
  },
  {
    slug: "synopsis",
    title: "Synopsis",
    description: "A summary of Codependence.",
    section: "Project",
  },
  {
    slug: "why-use-codependence",
    title: "Why use Codependence?",
    description: "Codependence enforces dependency version policy where your code runs.",
    section: "Project",
  },
  {
    slug: "why-not-use-codependence",
    title: "Why not use Codependence?",
    description: "Reasons why Codependence might not be the right choice for your project.",
    section: "Project",
  },
];

export function getAllDocs(): DocMeta[] {
  return docs;
}

export function getDocBySlug(slug: string): DocMeta | undefined {
  return docs.find((doc) => doc.slug === slug);
}

export function getDocsBySection(): Array<{ title: DocMeta["section"]; items: DocMeta[] }> {
  const sections: DocMeta["section"][] = ["Getting Started", "Usage", "Reference", "Project"];
  return sections.map((title) => ({
    title,
    items: docs.filter((doc) => doc.section === title),
  }));
}

export function getPagination(slug: string): { prevItem?: DocMeta; nextItem?: DocMeta } {
  const index = docs.findIndex((doc) => doc.slug === slug);
  return {
    prevItem: index > 0 ? docs[index - 1] : undefined,
    nextItem: index >= 0 && index < docs.length - 1 ? docs[index + 1] : undefined,
  };
}

export function loadDoc(slug: string): Effect.Effect<LoadedDoc, Error> {
  return Effect.tryPromise({
    try: async () => {
      const doc = getDocBySlug(slug);
      if (!doc) throw new Error(`Unknown doc: ${slug}`);

      const path = `./docs/${slug}.mdx`;
      const [source, module] = await Promise.all([rawDocModules[path]?.(), docModules[path]?.()]);

      if (!source || !module?.default) {
        throw new Error(`Missing doc module: ${slug}`);
      }

      return {
        doc,
        source,
        Content: module.default,
        headings: extractHeadings(source),
      };
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });
}
