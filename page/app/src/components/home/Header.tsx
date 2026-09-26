import { Menu } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { useLocation, Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GITHUB_URL } from "@/constants";
import type { MobileMenuProps, NavItemProps } from "@/types";
import { NAVIGATION } from "./constants";

function NavItem({ href, title, isActive }: NavItemProps) {
  return (
    <li>
      <a
        href={href}
        className={`flex rounded-md px-3 py-2 transition hover:bg-surface-raised hover:text-primary ${isActive ? "bg-surface-raised text-primary" : ""}`}
      >
        {title}
      </a>
    </li>
  );
}

function MobileMenu({ pathname }: MobileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-12 rounded-lg lg:hidden"
          />
        }
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="mt-3 w-52">
        {NAVIGATION.map((item) => (
          <DropdownMenuItem
            key={item.href}
            render={<a href={item.href} />}
            className={pathname === item.href ? "bg-muted text-primary" : ""}
          >
            {item.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-30">
      <nav className="flex h-16 items-center justify-between border-b border-foreground/20 bg-muted/90 px-2 py-2 font-sans backdrop-blur-3xl sm:px-4 md:px-20">
        <MobileMenu pathname={pathname} />

        <div className="flex flex-1 items-center lg:flex-none">
          <Link to="/" className="px-2">
            <h1 className="text-xl md:text-2xl font-bold text-primary">
              Codependence
            </h1>
          </Link>
        </div>

        <div className="hidden lg:flex lg:flex-1 lg:justify-center">
          <ul className="flex items-center gap-1 text-base font-medium">
            {NAVIGATION.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isActive={pathname === item.href}
              />
            ))}
          </ul>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-8 rounded-lg"
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
