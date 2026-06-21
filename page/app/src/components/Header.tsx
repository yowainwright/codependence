import { lazy, Suspense } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, Moon, Search as SearchIcon, Sun } from "lucide-react";
import { getAllDocs } from "@/content";
import { GithubIcon } from "@/components/icons/GithubIcon";
import { useTheme } from "@/hooks/useTheme";

const Search = lazy(() => import("@/components/docs/Search"));

const navigation = [{ title: "Docs", href: "/docs/introduction" }];

export function Header() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const pathname = location.pathname;
  const searchData = getAllDocs().map((doc) => ({
    title: doc.title,
    description: doc.description,
    content: "",
    slug: doc.slug,
  }));

  return (
    <header className="fixed top-0 z-50 w-full">
      <nav className="flex h-[68px] w-full items-center justify-between gap-2 border-b border-base-content/10 bg-base-100/90 px-2 py-2 backdrop-blur-2xl sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <label
            htmlFor="docs-drawer"
            className="btn btn-sm btn-ghost btn-circle lg:hidden"
            aria-label="Toggle docs navigation"
          >
            <Menu className="h-4 w-4" />
          </label>
          <Link
            to="/"
            preload="intent"
            className="btn btn-ghost min-w-0 max-w-[11rem] gap-2 px-1.5 sm:max-w-none sm:px-2"
          >
            <img
              src={`${import.meta.env.BASE_URL}logos/codependence.svg`}
              alt=""
              className="h-6 w-6 sm:h-7 sm:w-7"
            />
            <span className="gradient-text truncate text-base font-bold sm:text-2xl">
              Codependence
            </span>
          </Link>
        </div>

        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          {navigation.map((item) => {
            const isActive = pathname.includes("/docs");
            return (
              <Link
                key={item.href}
                to="/docs/$slug"
                params={{ slug: "introduction" }}
                preload="intent"
                className={`btn btn-sm btn-ghost hidden sm:flex ${
                  isActive ? "bg-primary/10 text-primary" : ""
                }`}
              >
                {item.title}
              </Link>
            );
          })}
          <Suspense
            fallback={
              <button className="btn btn-sm btn-ghost btn-circle" aria-label="Search">
                <SearchIcon className="h-4 w-4" />
              </button>
            }
          >
            <Search searchData={searchData} iconOnly />
          </Suspense>
          <a
            className="btn btn-sm btn-ghost btn-circle hidden sm:flex"
            href="https://github.com/yowainwright/codependence"
            aria-label="GitHub"
            target="_blank"
            rel="noreferrer"
          >
            <GithubIcon className="h-4 w-4" />
          </a>
          <button
            aria-label="Toggle theme"
            onClick={toggle}
            className={`btn btn-sm btn-ghost btn-circle swap swap-rotate ${
              theme === "codependence-dark" ? "swap-active" : ""
            }`}
          >
            <Sun className="swap-off h-4 w-4" />
            <Moon className="swap-on h-4 w-4" />
          </button>
        </div>
      </nav>
    </header>
  );
}
