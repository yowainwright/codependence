import { useLocation, Link } from "@tanstack/react-router";
import SIDEBAR from "@/constants/sidebar";
import { resolveUrl } from "@/utils/urlResolver";

function SideBarHeader() {
  return (
    <div className="bg-base-100 sticky top-0 z-20 items-center gap-2 bg-opacity-90 px-4 py-2 backdrop-blur lg:flex font-sans">
      <Link to="/" className="px-2">
        <h1 className="text-2xl font-bold text-primary">Codependence</h1>
      </Link>
    </div>
  );
}

function SideBarItem({ href, title, isActive }: { href: string; title: string; isActive: boolean }) {
  const baseClass = "block py-1.5 pl-[20px] -ml-[10px] -mr-[16px] transition text-sm";
  const activeClass = "text-primary border-l-2 border-primary";
  const inactiveClass = "hover:text-primary border-l-2 border-transparent hover:border-base-content/30";

  return (
    <li>
      <a href={href} className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}>
        {title}
      </a>
    </li>
  );
}

export function SideBar() {
  const { pathname } = useLocation();

  return (
    <div className="drawer-side z-40 md:border-r md:border-base-content/10">
      <label htmlFor="my-drawer-2" aria-label="close sidebar" className="drawer-overlay" />
      <aside className="bg-base-100 min-h-screen w-80">
        <SideBarHeader />
        <ul className="menu w-full px-4 py-0 font-sans">
          {SIDEBAR.map((section) => (
            <li key={section.title}>
              <h2 className="menu-title flex items-center gap-4 px-1.5">{section.title}</h2>
              <ul className="border-l border-base-content/10 ml-3">
                {section.items.map((item) => (
                  <SideBarItem
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    isActive={pathname === item.href}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
