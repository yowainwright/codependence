import { useState, useEffect, useMemo, useRef } from "react";
import Fuse from "fuse.js";
import { X } from "lucide-react";
import { SEARCH_DATA } from "@/content/constants";
import { resolveDocsUrl } from "../../utils/urlResolver";
import type { SearchResult } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const MAX_SEARCH_RESULTS = 5;
const SEARCH_FOCUS_DELAY_MS = 100;
const DESKTOP_SEARCH_MEDIA_QUERY = "(min-width: 768px)";
const QUICK_LINKS = [
  {
    href: resolveDocsUrl("introduction"),
    title: "Introduction to Codependence",
  },
  { href: resolveDocsUrl("cli"), title: "CLI Usage Guide" },
];

const SEARCH_ICON_PATH = "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z";

type SearchIconProps = {
  className: string;
  path: string;
};

type SearchKeyboardState = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  setQuery: (query: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

function SearchIcon({ className, path }: SearchIconProps) {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useSearchResults(query);

  useSearchKeyboard({ isOpen, setIsOpen, setQuery, inputRef });
  return { isOpen, setIsOpen, query, setQuery, results, inputRef };
}

function useDesktopSearchLayout() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_SEARCH_MEDIA_QUERY);
    const updateLayout = () => setIsDesktop(desktopQuery.matches);
    updateLayout();
    desktopQuery.addEventListener("change", updateLayout);
    return () => desktopQuery.removeEventListener("change", updateLayout);
  }, []);

  return isDesktop;
}

function useSearchResults(query: string) {
  const fuse = useMemo(
    () =>
      new Fuse(SEARCH_DATA, {
        keys: ["title", "description", "content"],
        threshold: 0.3,
        includeScore: true,
      }),
    [],
  );
  const results = useMemo(
    () =>
      fuse
        .search(query)
        .slice(0, MAX_SEARCH_RESULTS)
        .map((result) => result.item),
    [fuse, query],
  );
  return results;
}

function useSearchKeyboard(state: SearchKeyboardState) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => handleSearchKeyDown(event, state);
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state.inputRef, state.isOpen, state.setIsOpen, state.setQuery]);
}

function handleSearchKeyDown(event: KeyboardEvent, state: SearchKeyboardState) {
  const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
  if (isSearchShortcut) {
    event.preventDefault();
    openSearch(state);
  }

  const shouldCloseSearch = event.key === "Escape" && state.isOpen;
  if (shouldCloseSearch) closeSearch(state);
}

type SearchState = ReturnType<typeof useSearchState>;

function useSearchOutsideClick(
  containerRef: React.RefObject<HTMLDivElement | null>,
  state: SearchState,
  isEnabled: boolean,
) {
  const { isOpen, setIsOpen, setQuery } = state;
  const shouldListenForOutsideClick = isEnabled && isOpen;
  useEffect(() => {
    if (!shouldListenForOutsideClick) return;

    const handlePointerDown = (event: PointerEvent) => {
      const clickedOutside =
        event.target instanceof Node && !containerRef.current?.contains(event.target);
      if (clickedOutside) {
        setIsOpen(false);
        setQuery("");
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [shouldListenForOutsideClick, setIsOpen, setQuery]);
}

type SearchContentProps = {
  state: SearchState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  open: () => void;
  close: () => void;
};

function SearchContent({ state, containerRef, open, close }: SearchContentProps) {
  if (!state.isOpen) {
    return <SearchClosedContent containerRef={containerRef} open={open} />;
  }

  return <SearchOpenContent state={state} containerRef={containerRef} close={close} />;
}

type SearchContentRef = Pick<SearchContentProps, "containerRef">;

function SearchClosedContent({ containerRef, open }: SearchContentRef & { open: () => void }) {
  return (
    <div ref={containerRef} className="relative">
      <SearchButton open={open} />
    </div>
  );
}

function SearchOpenContent({
  state,
  containerRef,
  close,
}: SearchContentRef & { state: SearchState; close: () => void }) {
  return (
    <div
      ref={containerRef}
      className="fixed inset-x-2 top-2 z-50 md:relative md:inset-auto md:z-auto md:w-72 lg:w-80"
    >
      <SearchField inputRef={state.inputRef} query={state.query} setQuery={state.setQuery} />
      <SearchResultDropdown state={state} close={close} />
    </div>
  );
}

function SearchResultDropdown({ state, close }: { state: SearchState; close: () => void }) {
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl border border-foreground/10 bg-popover text-popover-foreground shadow-2xl md:left-auto md:w-[min(32rem,calc(100vw-2rem))]">
      <SearchResults query={state.query} results={state.results} close={close} reset={close} />
    </div>
  );
}

function openSearch(state: Pick<SearchKeyboardState, "inputRef" | "setIsOpen">) {
  state.setIsOpen(true);
  window.setTimeout(() => state.inputRef.current?.focus(), SEARCH_FOCUS_DELAY_MS);
}

function closeSearch(state: Pick<SearchKeyboardState, "setIsOpen" | "setQuery">) {
  state.setIsOpen(false);
  state.setQuery("");
}

function useSearchControls(isDesktop: boolean) {
  const state = useSearchState();
  const containerRef = useRef<HTMLDivElement>(null);
  useSearchOutsideClick(containerRef, state, isDesktop);
  const open = () => openSearch(state);
  const close = () => closeSearch(state);
  return { state, containerRef, open, close };
}

export default function Search() {
  const isDesktop = useDesktopSearchLayout();
  const controls = useSearchControls(isDesktop);
  if (!isDesktop) return <MobileSearchDialog controls={controls} />;

  return (
    <SearchContent
      state={controls.state}
      containerRef={controls.containerRef}
      open={controls.open}
      close={controls.close}
    />
  );
}

type SearchControls = ReturnType<typeof useSearchControls>;

function MobileSearchDialog({ controls }: { controls: SearchControls }) {
  const { state, open, close } = controls;
  return (
    <>
      <SearchButton open={open} />
      <Dialog
        open={state.isOpen}
        onOpenChange={(isOpen) => handleDialogOpenChange(isOpen, open, close)}
      >
        <DialogContent
          showCloseButton={false}
          className="fixed inset-0 left-0 top-0 flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0"
        >
          <DialogTitle className="sr-only">Search documentation</DialogTitle>
          <MobileSearchField state={state} close={close} />
          <MobileSearchResults state={state} close={close} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function handleDialogOpenChange(isOpen: boolean, open: () => void, close: () => void) {
  if (isOpen) open();
  if (!isOpen) close();
}

function MobileSearchField({ state, close }: { state: SearchState; close: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <div className="min-w-0 flex-1">
        <SearchField
          inputRef={state.inputRef}
          query={state.query}
          setQuery={state.setQuery}
          showEscape={false}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-10 shrink-0"
        aria-label="Close search"
        onClick={close}
      >
        <X className="size-5" />
      </Button>
    </div>
  );
}

function MobileSearchResults({ state, close }: { state: SearchState; close: () => void }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
      <SearchResults query={state.query} results={state.results} close={close} reset={close} />
    </div>
  );
}

type SearchInputProps = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  setQuery: (query: string) => void;
};

function SearchField({
  inputRef,
  query,
  setQuery,
  showEscape = true,
}: SearchInputProps & { showEscape?: boolean }) {
  return (
    <div className="flex h-12 items-center rounded-lg border border-foreground/10 bg-background px-3 shadow-lg md:shadow-none">
      <SearchIcon className="mr-3 h-5 w-5 text-primary" path={SEARCH_ICON_PATH} />
      <SearchInput inputRef={inputRef} query={query} setQuery={setQuery} />
      {showEscape && <SearchEscapeHint />}
    </div>
  );
}

function SearchEscapeHint() {
  return (
    <kbd className="ml-3 rounded bg-muted px-2 py-1 text-xs font-medium text-foreground/60">
      ESC
    </kbd>
  );
}

function SearchInput({ inputRef, query, setQuery }: SearchInputProps) {
  return (
    <Input
      ref={inputRef}
      type="text"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Search documentation..."
      aria-label="Search documentation"
      className="h-auto flex-1 border-0 bg-transparent px-0 text-base shadow-none outline-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0"
    />
  );
}

function SearchResultText({ result }: { result: SearchResult }) {
  const description = result.description ? (
    <div className="text-sm text-foreground/60 mt-0.5 line-clamp-2">{result.description}</div>
  ) : null;

  return (
    <div className="flex-1 min-w-0">
      <div className="font-medium text-foreground truncate">{result.title}</div>
      {description}
    </div>
  );
}

function SearchQuickLinks({ close }: { close: () => void }) {
  const links = QUICK_LINKS.map((link) => (
    <SearchQuickLink key={link.href} {...link} close={close} />
  ));

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground/40 uppercase tracking-wider px-4">
        Quick Links
      </div>
      {links}
    </div>
  );
}

function SearchQuickLink({
  href,
  title,
  close,
}: {
  href: string;
  title: string;
  close: () => void;
}) {
  return (
    <a
      href={href}
      className="block px-4 py-2 rounded-lg hover:bg-muted/50 transition-all text-sm"
      onClick={close}
    >
      <SearchQuickLinkText title={title} />
    </a>
  );
}

function SearchQuickLinkText({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <SearchIcon
        className="h-4 w-4 text-foreground/40"
        path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <span className="text-foreground/70">{title}</span>
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
  return getSearchContent({ query, results, close, reset });
}

function getSearchContent({ query, results, close, reset }: SearchResultsProps) {
  if (query.length === 0) return <SearchPrompt close={close} />;
  if (results.length === 0) return <NoResults />;
  return <SearchResultList results={results} reset={reset} />;
}

function NoResults() {
  return (
    <div className="p-8 text-center text-foreground/50">
      <div className="mb-2 text-lg font-medium">No results found</div>
      <div className="text-sm">Try searching for something else</div>
    </div>
  );
}

function SearchResultList({ results, reset }: { results: SearchResult[]; reset: () => void }) {
  const links = results.map((result, index) => (
    <SearchResultLink key={result.slug} result={result} selected={index === 0} reset={reset} />
  ));

  return <div className="p-2">{links}</div>;
}

function SearchPrompt({ close }: { close: () => void }) {
  return (
    <div className="p-8">
      <div className="mb-6 text-center text-sm text-foreground/60">Start typing to search</div>
      <SearchQuickLinks close={close} />
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
      <SearchResultCard result={result} />
    </a>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10">
        <SearchIcon
          className="h-5 w-5 text-primary"
          path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2-2z"
        />
      </div>
      <SearchResultText result={result} />
    </div>
  );
}

function SearchButton({ open }: { open: () => void }) {
  return (
    <Button
      variant="ghost"
      onClick={open}
      aria-label="Search documentation"
      className="h-8 justify-start gap-2 rounded-lg bg-muted/50 px-2 text-sm font-normal text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3"
    >
      <SearchIcon className="h-4 w-4" path={SEARCH_ICON_PATH} />
      <span className="hidden text-left sm:inline">Search</span>
      <kbd className="hidden items-center gap-1 rounded bg-surface-raised/50 px-1.5 py-0.5 text-xs font-medium sm:inline-flex">
        ⌘K
      </kbd>
    </Button>
  );
}
