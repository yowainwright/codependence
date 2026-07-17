import { Menu } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { GITHUB_URL } from "@/constants";
import Search from "./Search";

function DrawerToggle() {
  return (
    <label htmlFor="my-drawer-2" className="btn btn-square btn-ghost lg:hidden">
      <Menu className="w-5 h-5" />
    </label>
  );
}

export function DocsHeader() {
  return (
    <header className="sticky top-0 z-30">
      <nav className="navbar bg-base-100/90 shadow-sm backdrop-blur-lg justify-center items-center py-2 md:px-10 px-2 border-b border-base-content/10">
        <div className="navbar-start">
          <DrawerToggle />
          <Search />
        </div>
        <div className="navbar-end">
          <a
            className="btn btn-sm btn-ghost"
            href={GITHUB_URL}
            aria-label="github"
          >
            <FaGithub className="h-4 w-4" />
          </a>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
