import React, { useState, useEffect, useRef } from 'react';

const codeSnippets = [
  {
    id: 'init',
    title: 'Initialize',
    lines: [
      { text: '$ ', color: 'text-secondary' },
      { text: 'codependence init', color: 'text-base-content' },
      { text: '\n\n', color: '' },
      { text: '? Choose your strategy:', color: 'text-base-content/70' },
      { text: '\n  ', color: '' },
      { text: '❯ ', color: 'text-accent' },
      { text: 'Permissive', color: 'text-accent' },
      { text: ' - Update all to latest, pin specific', color: 'text-base-content/70' },
      { text: '\n    Pin all - Keep all at current versions', color: 'text-base-content/50' },
      { text: '\n\n', color: '' },
      { text: '✓', color: 'text-success' },
      { text: ' Created ', color: 'text-base-content' },
      { text: '.codependencerc', color: 'text-primary' }
    ]
  },
  {
    id: 'config',
    title: 'Config',
    lines: [
      { text: '// .codependencerc', color: 'text-base-content/50' },
      { text: '\n', color: '' },
      { text: '{', color: 'text-base-content' },
      { text: '\n  ', color: '' },
      { text: '"permissive"', color: 'text-primary' },
      { text: ': ', color: 'text-base-content' },
      { text: 'true', color: 'text-secondary' },
      { text: ',', color: 'text-base-content' },
      { text: '\n  ', color: '' },
      { text: '"codependencies"', color: 'text-primary' },
      { text: ': [', color: 'text-base-content' },
      { text: '\n    ', color: '' },
      { text: '// Pin React to v18', color: 'text-base-content/50' },
      { text: '\n    ', color: '' },
      { text: '{ ', color: 'text-base-content' },
      { text: '"react"', color: 'text-primary' },
      { text: ': ', color: 'text-base-content' },
      { text: '"^18.0.0"', color: 'text-success' },
      { text: ' },', color: 'text-base-content' },
      { text: '\n    ', color: '' },
      { text: '// All @types/* always latest', color: 'text-base-content/50' },
      { text: '\n    ', color: '' },
      { text: '"@types/*"', color: 'text-accent' },
      { text: '\n  ]', color: 'text-base-content' },
      { text: '\n}', color: 'text-base-content' }
    ]
  },
  {
    id: 'check',
    title: 'Check',
    lines: [
      { text: '$ ', color: 'text-secondary' },
      { text: 'codependence', color: 'text-base-content' },
      { text: '\n\n', color: '' },
      { text: 'Checking ', color: 'text-base-content/70' },
      { text: 'packages/app/package.json', color: 'text-info' },
      { text: '\n\n', color: '' },
      { text: '┌─────────────┬─────────┬──────────┬────────┐', color: 'text-base-content/50' },
      { text: '\n', color: '' },
      { text: '│ Package     │ Current │ Expected │ Status │', color: 'text-base-content/70' },
      { text: '\n', color: '' },
      { text: '├─────────────┼─────────┼──────────┼────────┤', color: 'text-base-content/50' },
      { text: '\n', color: '' },
      { text: '│ react       │ 18.3.1  │ ^18.0.0  │ ', color: 'text-base-content' },
      { text: '✓', color: 'text-success' },
      { text: '      │', color: 'text-base-content' },
      { text: '\n', color: '' },
      { text: '│ typescript  │ 5.3.3   │ latest   │ ', color: 'text-base-content' },
      { text: '⚠', color: 'text-warning' },
      { text: ' 5.6.3│', color: 'text-base-content' },
      { text: '\n', color: '' },
      { text: '│ @types/node │ 20.9.0  │ latest   │ ', color: 'text-base-content' },
      { text: '⚠', color: 'text-warning' },
      { text: ' 22.9 │', color: 'text-base-content' },
      { text: '\n', color: '' },
      { text: '└─────────────┴─────────┴──────────┴────────┘', color: 'text-base-content/50' }
    ]
  },
  {
    id: 'update',
    title: 'Update',
    lines: [
      { text: '$ ', color: 'text-secondary' },
      { text: 'codependence --update', color: 'text-base-content' },
      { text: '\n\n', color: '' },
      { text: 'Updating dependencies...', color: 'text-base-content/70' },
      { text: '\n\n', color: '' },
      { text: '↑', color: 'text-info' },
      { text: ' typescript ', color: 'text-base-content' },
      { text: '5.3.3', color: 'text-warning' },
      { text: ' → ', color: 'text-base-content/50' },
      { text: '5.6.3', color: 'text-success' },
      { text: '\n', color: '' },
      { text: '↑', color: 'text-info' },
      { text: ' @types/node ', color: 'text-base-content' },
      { text: '20.9.0', color: 'text-warning' },
      { text: ' → ', color: 'text-base-content/50' },
      { text: '22.9.0', color: 'text-success' },
      { text: '\n', color: '' },
      { text: '=', color: 'text-base-content/50' },
      { text: ' react ', color: 'text-base-content' },
      { text: '18.3.1', color: 'text-base-content/70' },
      { text: ' (pinned)', color: 'text-base-content/50' },
      { text: '\n\n', color: '' },
      { text: '✓', color: 'text-success' },
      { text: ' Updated ', color: 'text-base-content' },
      { text: '2', color: 'text-accent' },
      { text: ' dependencies in ', color: 'text-base-content' },
      { text: '3', color: 'text-info' },
      { text: ' packages', color: 'text-base-content' }
    ]
  }
];

const TYPING_SPEED = 12;
const PAUSE_BETWEEN_TABS = 2500;

export default function SpotlightCode() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayedChars, setDisplayedChars] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  const activeSnippet = codeSnippets[activeIndex];
  const fullText = activeSnippet.lines.map(l => l.text).join('');
  const totalChars = fullText.length;

  // Start animation when component enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasStarted.current) {
          hasStarted.current = true;
          setIsTyping(true);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Typing animation
  useEffect(() => {
    if (!isTyping) return;

    if (displayedChars < totalChars) {
      const timeout = setTimeout(() => {
        setDisplayedChars(prev => prev + 1);
      }, TYPING_SPEED);
      return () => clearTimeout(timeout);
    }

    // Finished typing current tab
    const pauseTimeout = setTimeout(() => {
      const nextIndex = (activeIndex + 1) % codeSnippets.length;
      setActiveIndex(nextIndex);
      setDisplayedChars(0);
    }, PAUSE_BETWEEN_TABS);

    return () => clearTimeout(pauseTimeout);
  }, [displayedChars, totalChars, isTyping, activeIndex]);

  // Reset when tab changes manually
  const handleTabClick = (index: number) => {
    setActiveIndex(index);
    setDisplayedChars(0);
    setIsTyping(true);
  };

  const tabs = codeSnippets.map((snippet, index) => {
    const isActive = activeIndex === index;
    const baseClass = 'px-3 py-1 text-xs font-medium rounded-md transition-all duration-200';
    const activeClass = 'bg-primary/20 text-primary';
    const inactiveClass = 'text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5';

    return (
      <button
        key={snippet.id}
        onClick={() => handleTabClick(index)}
        className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
      >
        {snippet.title}
      </button>
    );
  });

  // Build displayed content with proper coloring
  const buildDisplayedContent = () => {
    let charCount = 0;
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < activeSnippet.lines.length; i++) {
      const line = activeSnippet.lines[i];
      const lineStart = charCount;
      const lineEnd = charCount + line.text.length;

      if (lineStart >= displayedChars) break;

      const visibleLength = Math.min(displayedChars - lineStart, line.text.length);
      const visibleText = line.text.slice(0, visibleLength);

      elements.push(
        <span key={i} className={line.color || 'text-base-content'}>
          {visibleText}
        </span>
      );

      charCount = lineEnd;
    }

    return elements;
  };

  const isComplete = displayedChars >= totalChars;

  return (
    <div ref={containerRef} className="w-full max-w-3xl xl:w-[48rem] mt-10 xl:mt-0">
      <div className="relative overflow-hidden rounded-xl border border-base-content/10 shadow-2xl">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20 rounded-xl blur-xl opacity-50" />

        <div className="relative">
          <div className="bg-base-200 px-4 py-3 flex items-center justify-between">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-error/80" />
              <div className="w-3 h-3 rounded-full bg-warning/80" />
              <div className="w-3 h-3 rounded-full bg-success/80" />
            </div>
            <div className="flex gap-1">{tabs}</div>
            <div className="w-[52px]" />
          </div>

          <div className="bg-base-300/80 backdrop-blur-sm p-6 min-h-[320px]">
            <pre className="text-sm font-mono leading-relaxed">
              <code>
                {buildDisplayedContent()}
                {!isComplete && (
                  <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse" />
                )}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
