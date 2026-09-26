import { useLocation, Link } from "@tanstack/react-router";
import { SIDEBAR } from "@/content/constants";
import type { SideBarItemProps } from "@/types";

type SideBarSectionProps = {
  pathname: string;
  section: (typeof SIDEBAR)[number];
};

function SideBarItem({ href, title, isActive }: SideBarItemProps) {
  const baseClass = "block py-1.5 pl-[20px] -ml-[10px] -mr-[16px] transition text-sm";
  const activeClass = "text-primary border-l-2 border-primary";
  const inactiveClass =
    "border-l-2 border-transparent hover:border-foreground/30 hover:text-primary";
  const slug = href.split("/").pop() ?? "";
  const activeItemClass = `${baseClass} ${activeClass}`;
  const inactiveItemClass = `${baseClass} ${inactiveClass}`;
  const itemClass = isActive ? activeItemClass : inactiveItemClass;

  return (
    <li>
      <Link to="/docs/$slug" params={{ slug }} className={itemClass}>
        {title}
      </Link>
    </li>
  );
}

function SideBarSection({ pathname, section }: SideBarSectionProps) {
  const items = section.items.map((item) => (
    <SideBarItem
      key={item.href}
      href={item.href}
      title={item.title}
      isActive={pathname === item.href}
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

export function SideBar() {
  const { pathname } = useLocation();
  const sections = SIDEBAR.map((section) => (
    <SideBarSection key={section.title} pathname={pathname} section={section} />
  ));

  return (
    <nav aria-label="Documentation navigation" className="w-full bg-background font-sans">
      <ul className="w-full px-4 py-0">{sections}</ul>
    </nav>
  );
}
