export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

const FRONTMATTER_REGEX = /^---\n[\s\S]*?\n---\n?/;
const HEADING_REGEX = /^(#{2,4})\s+(.+)$/gm;

export function stripFrontmatter(source: string): string {
  return source.replace(FRONTMATTER_REGEX, "");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function extractHeadings(source: string): Heading[] {
  const stripped = stripFrontmatter(source);
  const seen = new Map<string, number>();

  return Array.from(stripped.matchAll(HEADING_REGEX)).map((match) => {
    const depth = match[1].length;
    const text = match[2].trim();
    const baseSlug = slugify(text);
    const count = seen.get(baseSlug) ?? 0;
    seen.set(baseSlug, count + 1);

    return {
      depth,
      text,
      slug: count === 0 ? baseSlug : `${baseSlug}-${count}`,
    };
  });
}
