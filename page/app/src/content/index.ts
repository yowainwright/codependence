import type { DocComponent, DocMeta, DocModule } from "@/types";
import { DOCS } from "./constants";

export type { DocComponent } from "@/types";

const docModules = import.meta.glob<DocModule>("./docs/*.mdx");

const rawDocModules = import.meta.glob("./docs/*.mdx", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

export function getDocBySlug(slug: string): DocMeta | undefined {
  return DOCS.find((doc) => doc.slug === slug);
}

export async function getDocContent(slug: string): Promise<string | undefined> {
  const p = `./docs/${slug}.mdx`;
  return rawDocModules[p]?.();
}

export async function getDocComponent(
  slug: string,
): Promise<DocComponent | undefined> {
  const p = `./docs/${slug}.mdx`;
  const mod = await docModules[p]?.();
  return mod?.default;
}

export function getAllDocs(): DocMeta[] {
  return DOCS;
}
