import React from 'react';
import type { LineSegment, TypeStep } from './types';
import { SPINNER_FRAMES } from './constants';
import { useIntersectionObserver, useTerminalAnimation } from './hooks';

function TerminalHeader() {
  return (
    <div className="bg-base-200 px-4 py-3 flex items-center justify-between">
      <div className="flex gap-2">
        <div className="w-3 h-3 rounded-full bg-error/80" />
        <div className="w-3 h-3 rounded-full bg-warning/80" />
        <div className="w-3 h-3 rounded-full bg-success/80" />
      </div>
      <span className="text-xs text-base-content/50 font-mono">~/my-project</span>
      <div className="w-[52px]" />
    </div>
  );
}

type SegmentProps = {
  segment: LineSegment;
  keyPrefix: string;
  index: number;
};

function Segment({ segment, keyPrefix, index }: SegmentProps) {
  return (
    <span key={`${keyPrefix}-${index}`} className={segment.color || 'text-base-content'}>
      {segment.text}
    </span>
  );
}

function Cursor() {
  return <span className="inline-block w-2 h-4 ml-0.5 bg-primary animate-pulse" />;
}

type SpinnerProps = {
  frame: number;
  text: string;
};

function Spinner({ frame, text }: SpinnerProps) {
  return (
    <>
      <span className="text-primary">{SPINNER_FRAMES[frame]}</span>
      <span className="text-base-content"> {text}</span>
    </>
  );
}

type TypingContentProps = {
  step: TypeStep;
  charIndex: number;
};

function TypingContent({ step, charIndex }: TypingContentProps) {
  const elements: React.ReactNode[] = [];
  let remaining = charIndex;

  step.lines.forEach((segment, i) => {
    if (remaining <= 0) return;

    const visibleLength = Math.min(remaining, segment.text.length);
    const visibleText = segment.text.slice(0, visibleLength);
    remaining -= segment.text.length;

    elements.push(
      <span key={`typing-${i}`} className={segment.color || 'text-base-content'}>
        {visibleText}
      </span>
    );
  });

  const fullText = step.lines.map((l) => l.text).join('');
  const isTyping = charIndex < fullText.length;

  return (
    <>
      {elements}
      {isTyping && <Cursor />}
    </>
  );
}

type TerminalContentProps = {
  displayedContent: LineSegment[];
  currentStep: ReturnType<typeof useTerminalAnimation>['currentStep'];
  charIndex: number;
  spinnerFrame: number;
  isShowingSpinner: boolean;
};

function TerminalContent({
  displayedContent,
  currentStep,
  charIndex,
  spinnerFrame,
  isShowingSpinner,
}: TerminalContentProps) {
  return (
    <div className="bg-base-300/80 backdrop-blur-sm p-6 min-h-[280px]">
      <pre className="text-sm font-mono leading-relaxed">
        <code>
          {displayedContent.map((segment, i) => (
            <Segment key={`displayed-${i}`} segment={segment} keyPrefix="displayed" index={i} />
          ))}

          {isShowingSpinner && currentStep?.type === 'spinner' && (
            <Spinner frame={spinnerFrame} text={currentStep.text} />
          )}

          {currentStep?.type === 'type' && (
            <TypingContent step={currentStep} charIndex={charIndex} />
          )}
        </code>
      </pre>
    </div>
  );
}

export default function IntegrationTerminal() {
  const { containerRef, isVisible } = useIntersectionObserver();
  const { currentStep, displayedContent, charIndex, spinnerFrame, isShowingSpinner } =
    useTerminalAnimation(isVisible);

  return (
    <div ref={containerRef} className="w-full max-w-3xl xl:w-[48rem] mt-10 xl:mt-0">
      <div className="relative overflow-hidden rounded-xl border border-base-content/10 shadow-2xl">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20 rounded-xl blur-xl opacity-50" />

        <div className="relative">
          <TerminalHeader />
          <TerminalContent
            displayedContent={displayedContent}
            currentStep={currentStep}
            charIndex={charIndex}
            spinnerFrame={spinnerFrame}
            isShowingSpinner={isShowingSpinner}
          />
        </div>
      </div>
    </div>
  );
}
