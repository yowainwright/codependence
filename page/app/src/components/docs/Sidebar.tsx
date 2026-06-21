import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { getDocsBySection, type DocMeta } from "@/content";

export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const sections = getDocsBySection();
  const [openSections, setOpenSections] = useState(() => sections.map(() => true));

  const toggleSection = (index: number) => {
    setOpenSections((current) =>
      current.map((isOpen, itemIndex) => (itemIndex === index ? !isOpen : isOpen)),
    );
  };

  return (
    <aside className="drawer-side">
      <label htmlFor="docs-drawer" className="drawer-overlay lg:hidden" />
      <nav className="sticky top-[68px] z-20 h-[calc(100vh-68px)] w-64 overflow-y-auto border-r border-base-content/10 bg-base-100">
        <section className="space-y-3 px-3 pt-3">
          {sections.map((section, index) => (
            <SidebarSection
              key={section.title}
              title={section.title}
              items={section.items}
              isOpen={openSections[index]}
              onToggle={() => toggleSection(index)}
              pathname={pathname}
            />
          ))}
        </section>
      </nav>
    </aside>
  );
}

function SidebarSection({
  title,
  items,
  isOpen,
  onToggle,
  pathname,
}: {
  title: string;
  items: DocMeta[];
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
}) {
  return (
    <article>
      <button
        className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-semibold uppercase text-base-content/70 transition-colors hover:text-base-content"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span>{title}</span>
        <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
      </button>
      <nav className={isOpen ? "" : "hidden"}>
        <ul className="ml-2 mt-1 space-y-0.5 border-l-2 border-base-content/10 py-1">
          {items.map((item) => (
            <li key={item.slug}>
              <Link
                to="/docs/$slug"
                params={{ slug: item.slug }}
                preload="intent"
                className={`relative block py-2 pl-4 pr-3 text-sm transition-colors ${
                  pathname.endsWith(`/docs/${item.slug}`)
                    ? "bg-primary/10 font-medium text-primary before:absolute before:bottom-0 before:left-[-2px] before:top-0 before:w-0.5 before:bg-primary"
                    : "text-base-content/80 hover:bg-base-content/5 hover:text-primary"
                }`}
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
