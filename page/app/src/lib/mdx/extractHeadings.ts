import type { Heading } from "./types";
import { HEADING_REGEX, SLUG_STRIP_REGEX, SLUG_SPACE_REGEX } from "./constants";

function slugify(text: string): string {
  return text.toLowerCase().replace(SLUG_STRIP_REGEX, "").trim().replace(SLUG_SPACE_REGEX, "-");
}

function buildTree(flat: Heading[]): Heading[] {
  const tree: Heading[] = [];
  const parentMap = new Map<number, Heading>();

  flat.forEach((heading) => {
    const node: Heading = { ...heading, subheadings: [] };
    parentMap.set(node.depth, node);

    if (node.depth === 2) {
      tree.push(node);
      return;
    }

    let parentDepth = node.depth - 1;
    while (parentDepth >= 2 && !parentMap.has(parentDepth)) {
      parentDepth--;
    }

    const parent = parentMap.get(parentDepth);
    if (parent) parent.subheadings!.push(node);
  });

  return tree;
}

export function extractHeadings(source: string): Heading[] {
  const regex = new RegExp(HEADING_REGEX.source, HEADING_REGEX.flags);
  const flat: Heading[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    flat.push({ depth: match[1].length, slug: slugify(match[2]), text: match[2] });
  }

  return buildTree(flat);
}
