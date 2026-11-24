import type { ComponentType, ReactNode } from "react";

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

export interface BreadcrumbsProps {
  title: string;
}

export interface MdxContentProps {
  loading: boolean;
  Content: DocComponent | null;
}
