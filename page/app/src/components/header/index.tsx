import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import { GITHUB_URL } from "@/constants";
import Search from "@/components/docs/Search";

type SiteHeaderProps = {
  onOpenSidebar: (() => void) | undefined;
};

function Brand() {
  return (
    <Link to="/" className="min-w-0 px-1">
      <span className="truncate text-base font-bold text-primary sm:text-xl">Codependence</span>
    </Link>
  );
}

function SidebarMenu({ onOpenSidebar }: SiteHeaderProps) {
  if (!onOpenSidebar) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 lg:hidden"
      onClick={onOpenSidebar}
      aria-label="Open documentation menu"
    >
      <Menu className="size-5" />
    </Button>
  );
}

function DocsLink() {
  return (
    <Link
      to="/docs/$slug"
      params={{ slug: "introduction" }}
      className="rounded-md px-2 py-2 text-sm font-medium transition hover:bg-muted hover:text-primary"
    >
      Docs
    </Link>
  );
}

function GitHubLink() {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-lg"
      render={<a href={GITHUB_URL} aria-label="GitHub" />}
    >
      <FaGithub size={16} />
    </Button>
  );
}

export function SiteHeader({ onOpenSidebar }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-30">
      <nav className="relative flex h-16 items-center justify-between gap-1 border-b border-foreground/10 bg-background/90 px-2 py-2 font-sans shadow-sm backdrop-blur-lg sm:px-4 md:px-10">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <SidebarMenu onOpenSidebar={onOpenSidebar} />
          <Brand />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <DocsLink />
          <Search />
          <GitHubLink />
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
