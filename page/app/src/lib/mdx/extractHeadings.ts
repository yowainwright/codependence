import type { Heading } from "./types";
import { HEADING_REGEX, SLUG_STRIP_REGEX, SLUG_SPACE_REGEX } from "./constants";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(SLUG_STRIP_REGEX, "")
    .trim()
    .replace(SLUG_SPACE_REGEX, "-");
}

function buildTree(flat: Heading[]): Heading[] {
  let tree: Heading[] = [];
  const parentMap = new Map<number, Heading>();

  flat.forEach((heading) => {
    const node: Heading = { ...heading, subheadings: [] };

    if (node.depth === 2) {
      for (const key of parentMap.keys()) {
        if (key > 2) parentMap.delete(key);
      }
      tree = tree.concat(node);
      parentMap.set(node.depth, node);
      return;
    }

    parentMap.set(node.depth, node);

    let parentDepth = node.depth - 1;
    while (parentDepth >= 2 && !parentMap.has(parentDepth)) {
      parentDepth--;
    }

    const parent = parentMap.get(parentDepth);
    if (parent) {
      parent.subheadings = (parent.subheadings ?? []).concat(node);
    }
  });

  return tree;
}

export function extractHeadings(source: string): Heading[] {
  const regex = new RegExp(HEADING_REGEX.source, HEADING_REGEX.flags);
  let flat: Heading[] = [];
  let match: RegExpExecArray | null;

  match = regex.exec(source);
  while (match !== null) {
    const heading = {
      depth: match[1].length,
      slug: slugify(match[2]),
      text: match[2],
    };
    flat = flat.concat(heading);
    match = regex.exec(source);
  }

  return buildTree(flat);
}
