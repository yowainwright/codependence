import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Fuse from "fuse.js";
import { SEARCH_DATA } from "@/content/constants";
import { resolveDocsUrl } from "../../utils/urlResolver";
import type { SearchResult } from "@/types";

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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

function useSearchState() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
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
  useSearchOutsideClick(searchRef, isOpen, setIsOpen);
  return { isOpen, setIsOpen, query, setQuery, results, searchRef, inputRef };
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

function useSearchOutsideClick(
  searchRef: React.RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
) {
  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const isOutsideSearch = searchRef.current && !searchRef.current.contains(e.target as Node);
      if (isOutsideSearch) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);
}

export default function Search() {
  const state = useSearchState();
  const { isOpen, setIsOpen, inputRef } = state;
  return (
    <>
      {/* Search Button */}
      <SearchButton
        open={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
      />

      {/* Search Modal */}
      {isOpen && createPortal(<SearchModal state={state} />, document.body)}
    </>
  );
}

function SearchModal({ state }: { state: ReturnType<typeof useSearchState> }) {
  const { setIsOpen, query, setQuery, results, searchRef, inputRef } = state;
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-[101] overflow-y-auto">
        <div className="flex min-h-full items-start justify-center pt-[10vh] p-4">
          <div
            ref={searchRef}
            className="relative w-full max-w-2xl bg-base-100 rounded-xl shadow-2xl overflow-hidden border border-base-content/10"
          >
            {/* Search Input */}
            <SearchInput inputRef={inputRef} query={query} setQuery={setQuery} />

            {/* Search Results */}
            <SearchResults
              query={query}
              results={results}
              close={() => setIsOpen(false)}
              reset={() => {
                setIsOpen(false);
                setQuery("");
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function SearchResultText({ result }: { result: SearchResult }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="font-medium text-base-content truncate">{result.title}</div>
      {result.description && (
        <div className="text-sm text-base-content/60 mt-0.5 line-clamp-2">{result.description}</div>
      )}
    </div>
  );
}

function SearchQuickLinks({ close }: { close: () => void }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-base-content/40 uppercase tracking-wider px-4">
        Quick Links
      </div>
      <a
        href={resolveDocsUrl("introduction")}
        className="block px-4 py-2 rounded-lg hover:bg-base-200/50 transition-all text-sm"
        onClick={close}
      >
        <div className="flex items-center gap-2">
          <SearchIcon
            className="h-4 w-4 text-base-content/40"
            path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <span className="text-base-content/70">Introduction to Codependence</span>
        </div>
      </a>
      <a
        href={resolveDocsUrl("cli")}
        className="block px-4 py-2 rounded-lg hover:bg-base-200/50 transition-all text-sm"
        onClick={close}
      >
        <div className="flex items-center gap-2">
          <SearchIcon
            className="h-4 w-4 text-base-content/40"
            path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
          <span className="text-base-content/70">CLI Usage Guide</span>
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
        <div className="p-8 text-center text-base-content/50">
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
            <div className="text-base-content/60 text-sm">Start typing to search</div>
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
  const selectedClass = selected ? "bg-base-200/50" : "";
  const className = `block px-4 py-3 rounded-lg hover:bg-base-200/50 transition-all ${selectedClass}`;
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
    <div className="flex items-center p-4 border-b border-base-content/10">
      <SearchIcon className="h-5 w-5 mr-3 text-primary" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search documentation..."
        className="flex-1 bg-transparent outline-none text-lg placeholder-base-content/50 font-sans"
      />
      <kbd className="px-2 py-1 text-xs font-medium bg-base-200 text-base-content/60 rounded">
        ESC
      </kbd>
    </div>
  );
}

function SearchButton({ open }: { open: () => void }) {
  return (
    <button
      onClick={open}
      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-base-200/50 hover:bg-base-200 rounded-lg transition-colors min-w-[200px] md:min-w-[300px] text-base-content/60 hover:text-base-content/80"
    >
      <SearchIcon className="h-4 w-4" />
      <span className="flex-1 text-left">Search documentation...</span>
      <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-base-300/50 rounded">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
