import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  CODE_SNIPPETS,
  SPOTLIGHT_TAB_PAUSE_MS,
  SPOTLIGHT_TYPING_SPEED,
} from "./constants";

function useSpotlightVisibility(
  setIsTyping: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  // Start animation when component enters viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0]?.isIntersecting ?? false;
        const shouldStart = isIntersecting && !hasStarted.current;
        if (shouldStart) {
          hasStarted.current = true;
          setIsTyping(true);
        }
      },
      { threshold: 0.3 },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);
  return containerRef;
}

function useSpotlightAnimation() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayedChars, setDisplayedChars] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const containerRef = useSpotlightVisibility(setIsTyping);
  const activeSnippet = CODE_SNIPPETS[activeIndex];
  const fullText = activeSnippet.lines.map((l) => l.text).join("");
  const totalChars = fullText.length;

  // Typing animation
  useEffect(() => {
    if (!isTyping) return;

    if (displayedChars < totalChars) {
      const timeout = setTimeout(() => {
        setDisplayedChars((prev) => prev + 1);
      }, SPOTLIGHT_TYPING_SPEED);
      return () => clearTimeout(timeout);
    }

    // Finished typing current tab
    const pauseTimeout = setTimeout(() => {
      const nextIndex = (activeIndex + 1) % CODE_SNIPPETS.length;
      setActiveIndex(nextIndex);
      setDisplayedChars(0);
    }, SPOTLIGHT_TAB_PAUSE_MS);

    return () => clearTimeout(pauseTimeout);
  }, [displayedChars, totalChars, isTyping, activeIndex]);

  // Reset when tab changes manually
  const handleTabClick = (index: number) => {
    setActiveIndex(index);
    setDisplayedChars(0);
    setIsTyping(true);
  };

  const isComplete = displayedChars >= totalChars;
  return {
    activeIndex,
    activeSnippet,
    displayedChars,
    containerRef,
    handleTabClick,
    isComplete,
  };
}

function SpotlightTabs({
  activeIndex,
  handleTabClick,
}: Pick<
  ReturnType<typeof useSpotlightAnimation>,
  "activeIndex" | "handleTabClick"
>) {
  return CODE_SNIPPETS.map((snippet, index) => {
    const isActive = activeIndex === index;
    const activeClass = "bg-primary/20 text-primary";
    const inactiveClass =
      "text-foreground/50 hover:text-foreground/80 hover:bg-foreground/5";

    return (
      <Button
        key={snippet.id}
        variant="ghost"
        size="sm"
        onClick={() => handleTabClick(index)}
        className={`h-auto rounded-md px-3 py-1 text-xs font-medium transition-all duration-200 ${isActive ? activeClass : inactiveClass}`}
      >
        {snippet.title}
      </Button>
    );
  });
}

function SpotlightContent({
  activeSnippet,
  displayedChars,
}: Pick<
  ReturnType<typeof useSpotlightAnimation>,
  "activeSnippet" | "displayedChars"
>) {
  let charCount = 0;
  let elements: React.ReactNode[] = [];

  for (let i = 0; i < activeSnippet.lines.length; i++) {
    const line = activeSnippet.lines[i];
    const lineStart = charCount;
    const lineEnd = charCount + line.text.length;

    if (lineStart >= displayedChars) break;

    const visibleLength = Math.min(
      displayedChars - lineStart,
      line.text.length,
    );
    const visibleText = line.text.slice(0, visibleLength);

    elements = elements.concat(
      <span key={i} className={line.color || "text-foreground"}>
        {visibleText}
      </span>,
    );

    charCount = lineEnd;
  }

  return elements;
}

function SpotlightHeader({
  activeIndex,
  handleTabClick,
}: Pick<
  ReturnType<typeof useSpotlightAnimation>,
  "activeIndex" | "handleTabClick"
>) {
  return (
    <div className="bg-muted px-4 py-3 flex items-center justify-between">
      <div className="flex gap-2">
        <div className="w-3 h-3 rounded-full bg-error/80" />
        <div className="w-3 h-3 rounded-full bg-warning/80" />
        <div className="w-3 h-3 rounded-full bg-success/80" />
      </div>
      <div className="flex gap-1">
        <SpotlightTabs
          activeIndex={activeIndex}
          handleTabClick={handleTabClick}
        />
      </div>
      <div className="w-[52px]" />
    </div>
  );
}

function SpotlightPane({
  activeSnippet,
  displayedChars,
  isComplete,
}: Pick<
  ReturnType<typeof useSpotlightAnimation>,
  "activeSnippet" | "displayedChars" | "isComplete"
>) {
  return (
    <div className="bg-surface-raised/80 backdrop-blur-sm p-6 min-h-[320px]">
      <pre className="text-sm font-mono leading-relaxed">
        <code>
          <SpotlightContent
            activeSnippet={activeSnippet}
            displayedChars={displayedChars}
          />
          {!isComplete && (
            <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse" />
          )}
        </code>
      </pre>
    </div>
  );
}

export default function SpotlightCode() {
  const {
    activeIndex,
    activeSnippet,
    displayedChars,
    containerRef,
    handleTabClick,
    isComplete,
  } = useSpotlightAnimation();

  return (
    <div
      ref={containerRef}
      className="w-full max-w-3xl xl:w-[48rem] mt-10 xl:mt-0"
    >
      <div className="relative overflow-hidden rounded-xl border border-foreground/10 shadow-2xl">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20 rounded-xl blur-xl opacity-50" />

        <div className="relative">
          <SpotlightHeader
            activeIndex={activeIndex}
            handleTabClick={handleTabClick}
          />
          <SpotlightPane
            activeSnippet={activeSnippet}
            displayedChars={displayedChars}
            isComplete={isComplete}
          />
        </div>
      </div>
    </div>
  );
}
