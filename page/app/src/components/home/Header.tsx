import { Menu } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { useLocation, Link } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { resolveUrl, resolveDocsUrl } from "@/utils/urlResolver";

const navigation = [
  { title: "Home", href: resolveUrl("") },
  { title: "Docs", href: resolveDocsUrl("introduction") },
];

const GITHUB_URL = "https://github.com/yowainwright/codependence";

function NavItem({ href, title, isActive }: { href: string; title: string; isActive: boolean }) {
  return (
    <li>
      <a
        href={href}
        className={`hover:text-primary hover:bg-base-300 rounded-md transition flex ${isActive ? "text-primary bg-base-300" : ""}`}
      >
        {title}
      </a>
    </li>
  );
}

function MobileMenu({ pathname }: { pathname: string }) {
  return (
    <div className="dropdown">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-square lg:hidden border-none rounded-lg">
        <Menu className="h-5 w-5" />
      </div>
      <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
        {navigation.map((item) => (
          <NavItem key={item.href} {...item} isActive={pathname === item.href} />
        ))}
      </ul>
    </div>
  );
}

export function Header() {
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-30">
      <nav className="navbar bg-base-200 backdrop-blur-3xl justify-center items-center py-2 sm:px-0 md:px-20 font-sans border-b border-base-content/20">
        <MobileMenu pathname={pathname} />

        <div className="navbar-start">
          <Link to="/" className="px-2">
            <h1 className="text-xl md:text-2xl font-bold text-primary">Codependence</h1>
          </Link>
        </div>

        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal text-base font-medium">
            {navigation.map((item) => (
              <NavItem key={item.href} {...item} isActive={pathname === item.href} />
            ))}
          </ul>
        </div>

        <div className="navbar-end">
          <a className="btn btn-sm btn-ghost btn-square rounded-lg" href={GITHUB_URL} aria-label="github">
            <FaGithub className="h-4 w-4" />
          </a>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
