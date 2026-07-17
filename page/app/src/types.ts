import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface DocMeta {
  slug: string;
  title: string;
  description: string;
}

export type DocComponent = ComponentType<{
  components?: Record<string, ComponentType>;
}>;

export interface DocModule {
  default: DocComponent;
}

export interface DocsLayoutProps {
  children: ReactNode;
}

export interface HomeLayoutProps {
  children: ReactNode;
}

export interface CopyButtonProps {
  text?: string;
}

export interface IconProps {
  className?: string;
}

export interface SearchResult {
  title: string;
  description: string;
  content: string;
  slug: string;
}

export interface SidebarItem {
  title: string;
  href: string;
}

export interface PaginationResult {
  prevItem?: SidebarItem;
  nextItem?: SidebarItem;
}

export interface PaginationProps {
  slug: string;
}

export interface SideBarItemProps extends SidebarItem {
  isActive: boolean;
}

export interface NavigationItem {
  title: string;
  href: string;
}

export interface NavItemProps extends NavigationItem {
  isActive: boolean;
}

export interface MobileMenuProps {
  pathname: string;
}

export interface BreadcrumbsProps {
  title: string;
}

export interface MdxContentProps {
  loading: boolean;
  Content: DocComponent | null;
}

export interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface CodeLine {
  text: string;
  color: string;
}

export interface CodeSnippet {
  id: string;
  title: string;
  lines: CodeLine[];
}
