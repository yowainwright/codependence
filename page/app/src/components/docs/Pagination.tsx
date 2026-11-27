import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/common/Icons";
import { resolveDocsUrl } from "@/utils/urlResolver";
import { SIDEBAR } from "@/content/constants";
import type { PaginationProps, PaginationResult, SidebarItem } from "@/types";
import { Button } from "@/components/ui/button";

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

  const prevItem = index > 0 ? allItems[index - 1] : undefined;
  const nextItem =
    index < allItems.length - 1 ? allItems[index + 1] : undefined;
  return {
    prevItem,
    nextItem,
  };
}

export function Pagination({ slug }: PaginationProps) {
  const { prevItem, nextItem } = getPagination(slug);

  return (
    <nav aria-label="Adjacent documentation pages" className="flex gap-3 sm:gap-7">
      {prevItem && (
        <Button
          variant="outline"
          render={
            <Link
              to="/docs/$slug"
              params={{ slug: getSlugFromHref(prevItem.href) }}
            />
          }
          className="mr-auto h-auto min-h-10 min-w-0 shrink rounded-full bg-surface px-4 py-2 text-xs whitespace-normal shadow-sm md:text-sm"
        >
          <ChevronLeftIcon className="size-6" />
          {prevItem.title}
        </Button>
      )}
      {nextItem && (
        <Button
          variant="outline"
          render={
            <Link
              to="/docs/$slug"
              params={{ slug: getSlugFromHref(nextItem.href) }}
            />
          }
          className="ml-auto h-auto min-h-10 min-w-0 shrink rounded-full bg-surface px-4 py-2 text-xs whitespace-normal shadow-sm md:text-sm"
        >
          {nextItem.title}
          <ChevronRightIcon className="size-6" />
        </Button>
      )}
    </nav>
  );
}
