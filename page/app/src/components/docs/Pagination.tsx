import { ChevronLeftIcon, ChevronRightIcon } from "@/components/common/Icons";
import { resolveDocsUrl } from "@/utils/urlResolver";
import SIDEBAR from "@/constants/sidebar";

interface SidebarItem {
  title: string;
  href: string;
}

function getAllItems(): SidebarItem[] {
  return SIDEBAR.flatMap((section) => section.items);
}

function getPagination(slug: string): { prevItem?: SidebarItem; nextItem?: SidebarItem } {
  const allItems = getAllItems();
  const currentHref = resolveDocsUrl(slug);
  const index = allItems.findIndex((item) => item.href === currentHref);

  if (index === -1) return {};

  return {
    prevItem: index > 0 ? allItems[index - 1] : undefined,
    nextItem: index < allItems.length - 1 ? allItems[index + 1] : undefined,
  };
}

interface PaginationProps {
  slug: string;
}

export function Pagination({ slug }: PaginationProps) {
  const { prevItem, nextItem } = getPagination(slug);

  return (
    <div className="flex gap-7">
      {prevItem?.href && (
        <a className="mr-auto flex" href={prevItem.href}>
          <button className="btn btn-ghost rounded-full border-none hover:bg-base-200">
            <ChevronLeftIcon className="w-5 h-5" />
            <span className="text-xs md:text-sm font-medium">{prevItem.title}</span>
          </button>
        </a>
      )}
      {nextItem?.href && (
        <a className="ml-auto flex" href={nextItem.href}>
          <button className="btn btn-ghost rounded-full border-none hover:bg-base-200">
            <span className="text-xs md:text-sm font-medium">{nextItem.title}</span>
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </a>
      )}
    </div>
  );
}
