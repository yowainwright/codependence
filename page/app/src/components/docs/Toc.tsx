import { useEffect, useMemo, useState } from "react";
import type { Heading } from "@/lib/mdx";

interface TocProps {
  headings: Heading[];
}

export function Toc({ headings }: TocProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const visibleHeadings = useMemo(() => headings.filter((heading) => heading.depth <= 3), [headings]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries.find((entry) => entry.isIntersecting);
        if (active?.target.id) setActiveId(active.target.id);
      },
      {
        rootMargin: "-96px 0px -70% 0px",
        threshold: 0,
      },
    );

    const elements = visibleHeadings
      .map((heading) => document.getElementById(heading.slug))
      .filter((element): element is HTMLElement => Boolean(element));

    elements.forEach((element) => observer.observe(element));
    return () => elements.forEach((element) => observer.unobserve(element));
  }, [visibleHeadings]);

  if (visibleHeadings.length === 0) return null;

  return (
    <nav className="sticky top-28 w-64" aria-label="Table of contents">
      <h2 className="mb-3 text-xs font-semibold uppercase text-base-content/60">On this page</h2>
      <ul className="space-y-2">
        {visibleHeadings.map((heading) => {
          const isActive = activeId === heading.slug;
          return (
            <li key={heading.slug}>
              <a
                href={`#${heading.slug}`}
                className={`block border-l-2 py-1 pl-4 text-sm transition-colors ${
                  heading.depth === 3 ? "ml-3 text-base-content/60" : "text-base-content/70"
                } ${
                  isActive
                    ? "border-primary font-medium text-primary"
                    : "border-transparent hover:text-primary"
                }`}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
