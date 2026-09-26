import { useState, useEffect, useRef } from "react";
import Fuse from "fuse.js";
import { SEARCH_DATA } from "@/content/constants";
import { resolveDocsUrl } from "../../utils/urlResolver";
import type { SearchResult } from "@/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function SearchIcon({
  className,
  path = "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
}: {
  className: string;
  path?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={path}
      />
    </svg>
  );
}

function useSearchState() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Fuse.js
  const fuse = new Fuse(SEARCH_DATA, {
    keys: ["title", "description", "content"],
    threshold: 0.3,
    includeScore: true,
  });

  // Handle search
  useEffect(() => {
    if (query.length > 0) {
      const searchResults = fuse.search(query);
      setResults(searchResults.slice(0, 5).map((result) => result.item));
    } else {
      setResults([]);
    }
  }, [query]);

  useSearchKeyboard(inputRef, setIsOpen, setQuery);
  return { isOpen, setIsOpen, query, setQuery, results, inputRef };
}

function useSearchKeyboard(
  inputRef: React.RefObject<HTMLInputElement | null>,
  setIsOpen: (open: boolean) => void,
  setQuery: (query: string) => void,
) {
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isSearchShortcut = (e.metaKey || e.ctrlKey) && e.key === "k";
      if (isSearchShortcut) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}

export default function Search() {
  const state = useSearchState();
  const { isOpen, setIsOpen, inputRef } = state;
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <SearchButton
        open={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
      />

      <SearchModal state={state} />
    </Dialog>
  );
}

function SearchModal({ state }: { state: ReturnType<typeof useSearchState> }) {
  const { setIsOpen, query, setQuery, results, inputRef } = state;
  return (
    <DialogContent
      showCloseButton={false}
      className="top-[10vh] left-1/2 block max-h-[80vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 translate-y-0 overflow-hidden rounded-xl border border-foreground/10 bg-background p-0 shadow-2xl sm:max-w-2xl"
    >
      <DialogTitle className="sr-only">Search documentation</DialogTitle>
      <SearchInput inputRef={inputRef} query={query} setQuery={setQuery} />
      <SearchResults
        query={query}
        results={results}
        close={() => setIsOpen(false)}
        reset={() => {
          setIsOpen(false);
          setQuery("");
        }}
      />
    </DialogContent>
  );
}

function SearchResultText({ result }: { result: SearchResult }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="font-medium text-foreground truncate">{result.title}</div>
      {result.description && (
        <div className="text-sm text-foreground/60 mt-0.5 line-clamp-2">
          {result.description}
        </div>
      )}
    </div>
  );
}

function SearchQuickLinks({ close }: { close: () => void }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground/40 uppercase tracking-wider px-4">
        Quick Links
      </div>
      <a
        href={resolveDocsUrl("introduction")}
        className="block px-4 py-2 rounded-lg hover:bg-muted/50 transition-all text-sm"
        onClick={close}
      >
        <div className="flex items-center gap-2">
          <SearchIcon
            className="h-4 w-4 text-foreground/40"
            path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <span className="text-foreground/70">
            Introduction to Codependence
          </span>
        </div>
      </a>
      <a
        href={resolveDocsUrl("cli")}
        className="block px-4 py-2 rounded-lg hover:bg-muted/50 transition-all text-sm"
        onClick={close}
      >
        <div className="flex items-center gap-2">
          <SearchIcon
            className="h-4 w-4 text-foreground/40"
            path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <span className="text-foreground/70">CLI Usage Guide</span>
        </div>
      </a>
    </div>
  );
}

interface SearchResultsProps {
  query: string;
  results: SearchResult[];
  close: () => void;
  reset: () => void;
}

function SearchResults({ query, results, close, reset }: SearchResultsProps) {
  return (
    <div className="max-h-[60vh] overflow-y-auto">
      {query.length > 0 && results.length === 0 && (
        <div className="p-8 text-center text-foreground/50">
          <div className="text-lg font-medium mb-2">No results found</div>
          <div className="text-sm">Try searching for something else</div>
        </div>
      )}

      {results.length > 0 && (
        <div className="p-2">
          {results.map((result, index) => (
            <SearchResultLink
              key={result.slug}
              result={result}
              selected={index === 0}
              reset={reset}
            />
          ))}
        </div>
      )}

      {query.length === 0 && (
        <div className="p-8">
          <div className="text-center mb-6">
            <div className="text-foreground/60 text-sm">
              Start typing to search
            </div>
          </div>
          <SearchQuickLinks close={close} />
        </div>
      )}
    </div>
  );
}

function SearchResultLink({
  result,
  selected,
  reset,
}: {
  result: SearchResult;
  selected: boolean;
  reset: () => void;
}) {
  const selectedClass = selected ? "bg-muted/50" : "";
  const className = `block px-4 py-3 rounded-lg hover:bg-muted/50 transition-all ${selectedClass}`;
  return (
    <a href={resolveDocsUrl(result.slug)} className={className} onClick={reset}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
          <SearchIcon
            className="h-5 w-5 text-primary"
            path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </div>
        <SearchResultText result={result} />
      </div>
    </a>
  );
}

function SearchInput({
  inputRef,
  query,
  setQuery,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  setQuery: (query: string) => void;
}) {
  return (
    <div className="flex items-center p-4 border-b border-foreground/10">
      <SearchIcon className="h-5 w-5 mr-3 text-primary" />
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search documentation..."
        aria-label="Search documentation"
        className="h-auto flex-1 border-0 bg-transparent px-0 text-lg shadow-none outline-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0"
      />
      <kbd className="px-2 py-1 text-xs font-medium bg-muted text-foreground/60 rounded">
        ESC
      </kbd>
    </div>
  );
}

function SearchButton({ open }: { open: () => void }) {
  return (
    <Button
      variant="ghost"
      onClick={open}
      className="h-auto min-w-[200px] justify-start gap-2 rounded-lg bg-muted/50 px-3 py-1.5 text-sm font-normal text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:min-w-[300px]"
    >
      <SearchIcon className="h-4 w-4" />
      <span className="flex-1 text-left">Search documentation...</span>
      <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-surface-raised/50 rounded">
        <span className="text-xs">⌘</span>K
      </kbd>
    </Button>
  );
}
