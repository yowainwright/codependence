import { Menu } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { GITHUB_URL } from "@/constants";
import { Button } from "@/components/ui/button";
import Search from "./Search";

function DrawerToggle({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-12 lg:hidden"
      onClick={onOpenSidebar}
      aria-label="Open documentation menu"
    >
      <Menu className="w-5 h-5" />
    </Button>
  );
}

export function DocsHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  return (
    <header className="sticky top-0 z-30">
      <nav className="flex h-16 items-center justify-between border-b border-foreground/10 bg-background/90 px-2 py-2 shadow-sm backdrop-blur-lg md:px-10">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <DrawerToggle onOpenSidebar={onOpenSidebar} />
          <Search />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            render={<a href={GITHUB_URL} aria-label="github" />}
          >
            <FaGithub size={16} />
          </Button>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
