import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { GITHUB_URL } from "@/constants";
import { SIDEBAR } from "@/content/constants";
import type { SidebarItem } from "@/types";

type SideBarSectionProps = {
  section: (typeof SIDEBAR)[number];
  onNavigate?: () => void;
};

type SideBarProps = {
  onNavigate?: () => void;
};

const releaseTag = `v${import.meta.env.CODEPENDENCE_VERSION}`;
const [major, minor] = releaseTag.split(".");
const releaseSeries = `${major}.${minor}.*`;
const releaseUrl = `${GITHUB_URL}/releases/tag/${releaseTag}`;

function SideBarItem({ href, title, onNavigate }: SidebarItem & SideBarProps) {
  const slug = href.split("/").pop() ?? "";

  return (
    <li>
      <Link
        to="/docs/$slug"
        params={{ slug }}
        onClick={onNavigate}
        className="-ml-px flex min-h-11 items-center rounded-r-md border-l-2 border-transparent px-3 py-1.5 text-base transition-colors hover:bg-primary/5 hover:text-primary aria-[current=page]:border-primary aria-[current=page]:bg-primary/5 aria-[current=page]:text-primary lg:min-h-0"
      >
        {title}
      </Link>
    </li>
  );
}

function SideBarSection({ section, onNavigate }: SideBarSectionProps) {
  const items = section.items.map((item) => (
    <SideBarItem
      key={item.href}
      href={item.href}
      title={item.title}
      onNavigate={onNavigate}
    />
  ));

  return (
    <li>
      <h2 className="flex items-center gap-4 px-1.5 py-2 text-sm font-semibold text-muted-foreground">
        {section.title}
      </h2>
      <ul className="ml-3 border-l border-foreground/10">{items}</ul>
    </li>
  );
}

export function SideBar({ onNavigate }: SideBarProps) {
  const sections = SIDEBAR.map((section) => (
    <SideBarSection
      key={section.title}
      section={section}
      onNavigate={onNavigate}
    />
  ));

  return (
    <nav aria-label="Documentation navigation" className="flex w-full flex-col items-center px-4 font-sans">
      <Badge
        variant="outline"
        render={<a href={releaseUrl} />}
        className="mb-1 h-auto max-w-full rounded-(--radius) border-dashed border-foreground/40 px-2 py-2 text-center leading-normal text-balance whitespace-normal"
      >
        <span className="release-badge-text font-semibold">
          {releaseSeries}, prompt before making major updates
        </span>
      </Badge>
      <ul className="w-full">{sections}</ul>
    </nav>
  );
}
