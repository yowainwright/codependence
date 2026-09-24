import { useState, useEffect, useRef } from "react";
import type { LineSegment, AnimationStep } from "./types";
import {
  ANIMATION_STEPS,
  TYPING_SPEED_MS,
  SPINNER_FRAME_MS,
  LOOP_DELAY_MS,
  SPINNER_FRAMES,
} from "./constants";

export function useIntersectionObserver() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0]?.isIntersecting ?? false;
        const shouldStart = isIntersecting && !hasStarted.current;
        if (shouldStart) {
          hasStarted.current = true;
          setIsVisible(true);
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

  return { containerRef, isVisible };
}

function useTerminalState() {
  const [stepIndex, setStepIndex] = useState(0);
  const [displayedContent, setDisplayedContent] = useState<LineSegment[]>([]);
  const [charIndex, setCharIndex] = useState(0);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [isShowingSpinner, setIsShowingSpinner] = useState(false);

  return {
    stepIndex,
    setStepIndex,
    displayedContent,
    setDisplayedContent,
    charIndex,
    setCharIndex,
    spinnerFrame,
    setSpinnerFrame,
    isShowingSpinner,
    setIsShowingSpinner,
  };
}

function scheduleLoop({
  setStepIndex,
  setDisplayedContent,
  setCharIndex,
  setIsShowingSpinner,
}: ReturnType<typeof useTerminalState>) {
  const timeout = setTimeout(() => {
    setStepIndex(0);
    setDisplayedContent([]);
    setCharIndex(0);
    setIsShowingSpinner(false);
  }, LOOP_DELAY_MS);
  return () => clearTimeout(timeout);
}

function schedulePause(
  currentStep: Extract<AnimationStep, { type: "pause" }>,
  { setStepIndex }: ReturnType<typeof useTerminalState>,
) {
  const timeout = setTimeout(() => {
    setStepIndex((prev) => prev + 1);
  }, currentStep.duration);
  return () => clearTimeout(timeout);
}

function scheduleSpinner(
  currentStep: Extract<AnimationStep, { type: "spinner" }>,
  { setIsShowingSpinner, setSpinnerFrame, setStepIndex }: ReturnType<typeof useTerminalState>,
) {
  setIsShowingSpinner(true);

  const spinnerInterval = setInterval(() => {
    setSpinnerFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
  }, SPINNER_FRAME_MS);

  const timeout = setTimeout(() => {
    setIsShowingSpinner(false);
    setStepIndex((prev) => prev + 1);
  }, currentStep.duration);

  return () => {
    clearInterval(spinnerInterval);
    clearTimeout(timeout);
  };
}

function scheduleTyping(
  currentStep: Extract<AnimationStep, { type: "type" }>,
  {
    charIndex,
    setCharIndex,
    setDisplayedContent,
    setStepIndex,
  }: ReturnType<typeof useTerminalState>,
) {
  const fullText = currentStep.lines.map((l) => l.text).join("");

  if (charIndex < fullText.length) {
    const timeout = setTimeout(() => {
      setCharIndex((prev) => prev + 1);
    }, TYPING_SPEED_MS);
    return () => clearTimeout(timeout);
  }

  setDisplayedContent((prev) => [...prev, ...currentStep.lines]);
  setCharIndex(0);
  setStepIndex((prev) => prev + 1);
}

export function useTerminalAnimation(isVisible: boolean) {
  const state = useTerminalState();
  const { stepIndex, displayedContent, charIndex, spinnerFrame, isShowingSpinner } = state;
  const currentStep: AnimationStep | undefined = ANIMATION_STEPS[stepIndex];
  useEffect(() => {
    if (!isVisible) return;
    if (!currentStep) return scheduleLoop(state);
    if (currentStep.type === "pause") return schedulePause(currentStep, state);
    if (currentStep.type === "spinner") return scheduleSpinner(currentStep, state);
    return scheduleTyping(currentStep, state);
  }, [isVisible, stepIndex, charIndex, currentStep]);

  return {
    currentStep,
    displayedContent,
    charIndex,
    spinnerFrame,
    isShowingSpinner,
  };
}
