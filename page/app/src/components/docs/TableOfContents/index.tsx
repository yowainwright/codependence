import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TableOfContentsProps } from "./types";
import { HEADING_SELECTOR } from "./constants";

function currentHeading(headings: HTMLElement[], offset: number) {
  const remaining = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
  const atBottom = window.scrollY > 0 && remaining <= 1;
  if (atBottom) return headings.at(-1);
  return headings.findLast((heading) => heading.getBoundingClientRect().top <= offset + 1) ?? headings[0];
}

function revealActiveLink(nav: HTMLElement) {
  const link = nav.querySelector('[aria-current="location"]');
  if (!link) return;
  const bounds = nav.getBoundingClientRect();
  const { top, bottom } = link.getBoundingClientRect();
  const delta = Math.min(0, top - bounds.top) + Math.max(0, bottom - bounds.bottom);
  if (delta) nav.scrollBy({ top: delta, behavior: "instant" });
}

function useArticleHeadings({ articleRef }: TableOfContentsProps) {
  const [headings, setHeadings] = useState<HTMLElement[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const targets = Array.from(article.querySelectorAll<HTMLElement>(HEADING_SELECTOR));
    setHeadings(targets);
    if (!targets.length) return;
    const offset = parseFloat(getComputedStyle(targets[0]).scrollMarginTop);
    const update = () => setActiveId(currentHeading(targets, offset)?.id ?? "");
    const observer = new ResizeObserver(update);
    observer.observe(article);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [articleRef]);

  return { headings, activeId };
}

export function TableOfContents(props: TableOfContentsProps) {
  const { headings, activeId } = useArticleHeadings(props);
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    revealActiveLink(nav);
    const observer = new ResizeObserver(() => revealActiveLink(nav));
    observer.observe(nav);
    return observer.disconnect.bind(observer);
  }, [activeId]);

  if (headings.length === 0) return null;

  return (
    <nav ref={navRef} aria-label="On this page" className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto">
      <h2 className="mb-4 text-sm font-semibold">On this page</h2>
      <ul className="space-y-1 border-l border-foreground/15">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              aria-current={activeId === heading.id ? "location" : undefined}
              data-level={heading.tagName}
              className="-ml-px block border-l-2 border-transparent py-2 pl-3 pr-2 text-base break-words text-foreground/70 transition-colors hover:text-primary data-[level=H3]:pl-6 data-[level=H4]:pl-9 aria-[current=location]:border-primary aria-[current=location]:bg-primary/5 aria-[current=location]:font-semibold aria-[current=location]:text-primary"
            >
              {heading.textContent}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
