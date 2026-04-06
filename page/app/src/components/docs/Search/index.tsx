import { useState, useEffect, useRef, useMemo, forwardRef } from "react";
import { createPortal } from "react-dom";
import Fuse from "fuse.js";
import { resolveDocsUrl } from "../../../utils/urlResolver";
import { searchData } from "../../../utils/searchData";
import { FUSE_OPTIONS, QUICK_LINKS } from "./constants";
import { runSearch, isOpenShortcut, resolveNavigation } from "./utils";
import type { SearchResult } from "./types";

const SearchIcon = ({ className }: { className: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const DocIcon = ({ className }: { className: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

function SearchTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button onClick={onOpen} aria-label="Open search" aria-keyshortcuts="Meta+K" className="flex items-center gap-2 px-3 py-1.5 text-sm bg-base-200/50 hover:bg-base-200 rounded-lg transition-colors min-w-[200px] md:min-w-[300px] text-base-content/60 hover:text-base-content/80">
      <SearchIcon className="h-4 w-4" />
      <span className="flex-1 text-left">Search documentation...</span>
      <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-base-300/50 rounded">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}

const SearchInput = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}>(({ value, onChange, onKeyDown }, ref) => (
  <search className="flex items-center p-4 border-b border-base-content/10">
    <SearchIcon className="h-5 w-5 mr-3 text-primary" />
    <input
      ref={ref}
      type="search"
      role="combobox"
      aria-controls="search-results"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder="Search documentation..."
      className="flex-1 bg-transparent outline-none text-lg placeholder-base-content/50 font-outfit"
    />
    <kbd className="px-2 py-1 text-xs font-medium bg-base-200 text-base-content/60 rounded">ESC</kbd>
  </search>
));

function SearchResultItem({ result, isSelected, onSelect }: { result: SearchResult; isSelected: boolean; onSelect: () => void }) {
  return (
    <li role="option" aria-selected={isSelected}>
      <a href={resolveDocsUrl(result.slug)} onClick={onSelect} className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-base-200/50 transition-all ${isSelected ? "bg-base-200/50" : ""}`}>
        <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
          <DocIcon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-base-content truncate">{result.title}</p>
          {result.description && (
            <p className="text-sm text-base-content/60 mt-0.5 line-clamp-2">{result.description}</p>
          )}
        </div>
      </a>
    </li>
  );
}

function SearchQuickLinks({ onClose }: { onClose: () => void }) {
  return (
    <section className="p-8">
      <p className="text-center text-base-content/60 text-sm mb-6">Start typing to search</p>
      <nav aria-label="Quick links">
        <p className="text-xs font-medium text-base-content/40 uppercase tracking-wider px-4 mb-2">Quick Links</p>
        <ul>
          {QUICK_LINKS.map(({ slug, label }) => (
            <li key={slug}>
              <a href={resolveDocsUrl(slug)} onClick={onClose} className="block px-4 py-2 rounded-lg hover:bg-base-200/50 transition-all text-sm text-base-content/70">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}

function SearchBody({ query, results, selectedIndex, onSelect }: { query: string; results: SearchResult[]; selectedIndex: number; onSelect: () => void }) {
  const hasQuery = query.length > 0;
  const hasResults = results.length > 0;

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      {hasQuery && !hasResults && (
        <p className="p-8 text-center text-base-content/50">No results for &ldquo;{query}&rdquo;</p>
      )}
      {hasResults && (
        <ul id="search-results" role="listbox" aria-label="Search results" className="p-2">
          {results.map((result, index) => (
            <SearchResultItem key={result.slug} result={result} isSelected={selectedIndex === index} onSelect={onSelect} />
          ))}
        </ul>
      )}
      {!hasQuery && <SearchQuickLinks onClose={onSelect} />}
    </div>
  );
}

function SearchDialog({ children, onClose, dialogRef }: { children: React.ReactNode; onClose: () => void; dialogRef: React.RefObject<HTMLDivElement> }) {
  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <article role="dialog" aria-modal="true" aria-label="Search documentation" className="fixed inset-0 z-[101] overflow-y-auto">
        <div className="flex min-h-full items-start justify-center pt-[10vh] p-4">
          <div ref={dialogRef} className="relative w-full max-w-2xl bg-base-100 rounded-xl shadow-2xl overflow-hidden border border-base-content/10">
            {children}
          </div>
        </div>
      </article>
    </>
  );
}

export default function Search() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(() => new Fuse(searchData, FUSE_OPTIONS), []);

  const open = () => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); };
  const close = () => { setIsOpen(false); setQuery(""); };

  useEffect(() => { setResults(runSearch(fuse, query)); setSelectedIndex(0); }, [query, fuse]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpenShortcut(e)) { e.preventDefault(); open(); }
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const isOutside = dialogRef.current && !dialogRef.current.contains(e.target as Node);
      if (isOutside) close();
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleNavKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const action = resolveNavigation(e.key, selectedIndex, results);
    if (!action) return;
    e.preventDefault();
    if (action.next !== undefined) setSelectedIndex(action.next);
    if (action.navigate) { window.location.href = resolveDocsUrl(action.navigate); close(); }
  };

  return (
    <>
      <SearchTrigger onOpen={open} />
      {isOpen && createPortal(
        <SearchDialog onClose={close} dialogRef={dialogRef}>
          <SearchInput ref={inputRef} value={query} onChange={setQuery} onKeyDown={handleNavKeyDown} />
          <SearchBody query={query} results={results} selectedIndex={selectedIndex} onSelect={close} />
        </SearchDialog>,
        document.body,
      )}
    </>
  );
}
