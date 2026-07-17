import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/common/Icons";
import { resolveDocsUrl } from "@/utils/urlResolver";
import { SIDEBAR } from "@/content/constants";
import type { PaginationProps, PaginationResult, SidebarItem } from "@/types";

function getAllItems(): SidebarItem[] {
  return SIDEBAR.flatMap((section) => section.items);
}

function getSlugFromHref(href: string): string {
  return href.split("/").pop() ?? "";
}

function getPagination(slug: string): PaginationResult {
  const allItems = getAllItems();
  const currentHref = resolveDocsUrl(slug);
  const index = allItems.findIndex((item) => item.href === currentHref);

  if (index === -1) return {};

  return {
    prevItem: index > 0 ? allItems[index - 1] : undefined,
    nextItem: index < allItems.length - 1 ? allItems[index + 1] : undefined,
  };
}

export function Pagination({ slug }: PaginationProps) {
  const { prevItem, nextItem } = getPagination(slug);

  return (
    <div className="flex gap-7">
      {prevItem && (
        <Link
          to="/docs/$slug"
          params={{ slug: getSlugFromHref(prevItem.href) }}
          className="mr-auto btn btn-ghost rounded-full border-none hover:bg-base-200"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          <span className="text-xs md:text-sm font-medium">
            {prevItem.title}
          </span>
        </Link>
      )}
      {nextItem && (
        <Link
          to="/docs/$slug"
          params={{ slug: getSlugFromHref(nextItem.href) }}
          className="ml-auto btn btn-ghost rounded-full border-none hover:bg-base-200"
        >
          <span className="text-xs md:text-sm font-medium">
            {nextItem.title}
          </span>
          <ChevronRightIcon className="w-5 h-5" />
        </Link>
      )}
    </div>
  );
}
