import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DocMeta } from "@/content";

interface PaginationProps {
  prevItem?: DocMeta;
  nextItem?: DocMeta;
}

export function Pagination({ prevItem, nextItem }: PaginationProps) {
  return (
    <nav className="flex gap-4">
      {prevItem && (
        <Link
          to="/docs/$slug"
          params={{ slug: prevItem.slug }}
          preload="intent"
          className="mr-auto flex"
        >
          <button className="btn rounded-lg border border-base-content/10 bg-base-100 text-base-content/80 shadow-sm transition-colors hover:bg-base-content/5 hover:text-primary">
            <ChevronLeft className="h-5 w-5" />
            <span className="text-xs font-medium md:text-sm">{prevItem.title}</span>
          </button>
        </Link>
      )}

      {nextItem && (
        <Link
          to="/docs/$slug"
          params={{ slug: nextItem.slug }}
          preload="intent"
          className="ml-auto flex"
        >
          <button className="btn rounded-lg border border-base-content/10 bg-base-100 text-base-content/80 shadow-sm transition-colors hover:bg-base-content/5 hover:text-primary">
            <span className="text-xs font-medium md:text-sm">{nextItem.title}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </Link>
      )}
    </nav>
  );
}
