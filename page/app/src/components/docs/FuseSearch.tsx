import React, { useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import { FiSearch } from 'react-icons/fi';

interface SearchItem {
  title: string;
  content: string;
  url: string;
  section?: string;
}

export default function FuseSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const [searchIndex, setSearchIndex] = useState<SearchItem[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load search index
  useEffect(() => {
    const loadSearchIndex = async () => {
      try {
        const response = await fetch('/search-index.json');
        const data = await response.json();
        setSearchIndex(data);
      } catch (error) {
        console.error('Failed to load search index:', error);
        // Fallback to basic index
        setSearchIndex([
          { title: 'Introduction', content: 'Getting started with Codependence', url: '/documentation/introduction' },
          { title: 'CLI Usage', content: 'Command line interface documentation', url: '/documentation/cli' },
          { title: 'Node.js API', content: 'Using Codependence in Node.js', url: '/documentation/node' },
          { title: 'Options', content: 'Configuration options', url: '/documentation/options' },
          { title: 'Usage Examples', content: 'Example usage patterns', url: '/documentation/usage' },
          { title: 'Recipes', content: 'Common recipes and patterns', url: '/documentation/recipes' },
          { title: 'Main Use Case', content: 'Primary use cases for Codependence', url: '/documentation/main-usecase' },
        ]);
      }
    };
    loadSearchIndex();
  }, []);

  // Initialize Fuse.js
  const fuse = new Fuse(searchIndex, {
    keys: ['title', 'content', 'section'],
    includeScore: true,
    threshold: 0.3,
    minMatchCharLength: 2,
  });

  // Handle search
  useEffect(() => {
    if (query.length > 0) {
      const searchResults = fuse.search(query);
      setResults(searchResults.slice(0, 5).map(result => result.item));
    } else {
      setResults([]);
    }
  }, [query, searchIndex]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div ref={searchRef} className="relative">
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="btn btn-sm gap-2"
      >
        <FiSearch className="w-4 h-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="kbd kbd-xs hidden sm:inline">⌘K</kbd>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 right-0 sm:left-auto sm:right-auto sm:w-96 bg-base-100 rounded-lg shadow-xl border border-base-300 z-50">
          <div className="p-4">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50 w-4 h-4" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search documentation..."
                className="input input-bordered w-full pl-10 pr-4"
                autoFocus
              />
            </div>
          </div>

          {results.length > 0 && (
            <div className="border-t border-base-300">
              <ul className="py-2">
                {results.map((result, index) => (
                  <li key={index}>
                    <a
                      href={result.url}
                      className="block px-4 py-2 hover:bg-base-200 transition-colors"
                      onClick={() => {
                        setIsOpen(false);
                        setQuery('');
                      }}
                    >
                      <div className="font-semibold">{result.title}</div>
                      {result.content && (
                        <div className="text-sm text-base-content/70 line-clamp-1">
                          {result.content}
                        </div>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {query.length > 0 && results.length === 0 && (
            <div className="border-t border-base-300 p-4 text-center text-base-content/50">
              No results found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}