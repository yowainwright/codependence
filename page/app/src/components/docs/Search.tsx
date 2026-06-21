import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { useMachine } from "@xstate/react";
import Fuse from "fuse.js";
import { FileText, Search as SearchIcon } from "lucide-react";
import { searchMachine } from "@/machines/searchMachine";

export interface SearchResult {
  title: string;
  description: string;
  content: string;
  slug: string;
}

interface SearchProps {
  searchData: SearchResult[];
  iconOnly?: boolean;
}

export default function Search({ searchData, iconOnly = false }: SearchProps) {
  const [state, send] = useMachine(searchMachine);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = state.matches("open");
  const query = state.context.query;

  const fuse = useMemo(
    () =>
      new Fuse(searchData, {
        keys: ["title", "description", "content"],
        threshold: 0.3,
        includeScore: true,
      }),
    [searchData],
  );

  const results = useMemo(() => {
    if (query.length === 0) return [];
    return fuse
      .search(query)
      .slice(0, 6)
      .map((result) => result.item);
  }, [fuse, query]);

  const open = () => {
    send({ type: "OPEN" });
    window.setTimeout(() => inputRef.current?.focus(), 100);
  };

  const close = () => send({ type: "CLOSE" });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isSearchShortcut) {
        event.preventDefault();
        open();
      }

      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const clickedOutside =
        searchRef.current && !searchRef.current.contains(event.target as Node);
      if (clickedOutside) close();
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <button
        onClick={open}
        className={
          iconOnly
            ? "btn btn-sm btn-ghost btn-circle"
            : "flex min-w-[220px] items-center gap-2 rounded-lg bg-base-200/70 px-3 py-1.5 text-sm text-base-content/60 transition-colors hover:bg-base-200 hover:text-base-content/80 md:min-w-[300px]"
        }
        aria-label="Search documentation"
      >
        <SearchIcon className="h-4 w-4" />
        {!iconOnly && <span className="flex-1 text-left">Search documentation...</span>}
        {!iconOnly && (
          <kbd className="hidden items-center gap-0.5 rounded bg-base-300/70 px-1.5 py-0.5 text-xs font-medium text-base-content/60 md:inline-flex">
            <span>⌘</span>K
          </kbd>
        )}
      </button>

      {isOpen &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={close} />
            <div className="fixed inset-0 z-[101] overflow-y-auto">
              <div className="flex min-h-full items-start justify-center p-4 pt-[10vh]">
                <div
                  ref={searchRef}
                  className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-base-content/10 bg-base-100 shadow-2xl"
                >
                  <div className="flex items-center border-b border-base-content/10 p-4">
                    <SearchIcon className="mr-3 h-5 w-5 text-primary" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(event) =>
                        send({ type: "SET_QUERY", query: event.currentTarget.value })
                      }
                      placeholder="Search documentation..."
                      className="flex-1 bg-transparent text-lg outline-none placeholder:text-base-content/50"
                    />
                    <kbd className="rounded bg-base-200 px-2 py-1 text-xs font-medium text-base-content/60">
                      ESC
                    </kbd>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto">
                    {query.length > 0 && results.length === 0 && (
                      <div className="p-8 text-center text-base-content/50">
                        <div className="mb-2 text-lg font-medium">No results found</div>
                        <div className="text-sm">Try another dependency or command term</div>
                      </div>
                    )}

                    {results.length > 0 && (
                      <div className="p-2">
                        {results.map((result) => (
                          <Link
                            key={result.slug}
                            to="/docs/$slug"
                            params={{ slug: result.slug }}
                            className="block rounded-lg px-4 py-3 transition-colors hover:bg-base-200/70"
                            onClick={close}
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <FileText className="h-5 w-5" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-base-content">
                                  {result.title}
                                </span>
                                <span className="mt-0.5 line-clamp-2 block text-sm text-base-content/60">
                                  {result.description}
                                </span>
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {query.length === 0 && (
                      <div className="p-8">
                        <div className="mb-6 text-center text-sm text-base-content/60">
                          Start typing to search
                        </div>
                        <div className="space-y-2">
                          {searchData.slice(0, 4).map((item) => (
                            <Link
                              key={item.slug}
                              to="/docs/$slug"
                              params={{ slug: item.slug }}
                              className="block rounded-lg px-4 py-2 text-sm text-base-content/70 transition-colors hover:bg-base-200/70"
                              onClick={close}
                            >
                              {item.title}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
