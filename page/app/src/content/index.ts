import type { DocComponent, DocMeta, DocModule } from "@/types";
import { DOCS } from "./constants";

export type { DocComponent } from "@/types";

const docModules = import.meta.glob<DocModule>("./docs/*.mdx");

export function getDocBySlug(slug: string): DocMeta | undefined {
  return DOCS.find((doc) => doc.slug === slug);
}

export async function getDocComponent(slug: string): Promise<DocComponent | undefined> {
  const p = `./docs/${slug}.mdx`;
  const mod = await docModules[p]?.();
  return mod?.default;
}

export function getAllDocs(): DocMeta[] {
  return DOCS;
}
