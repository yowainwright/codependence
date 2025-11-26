import { useState, useEffect, useRef } from 'react';
import type { LineSegment, AnimationStep } from './types';
import {
  ANIMATION_STEPS,
  TYPING_SPEED_MS,
  SPINNER_FRAME_MS,
  LOOP_DELAY_MS,
  SPINNER_FRAMES,
} from './constants';

export function useIntersectionObserver() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0]?.isIntersecting ?? false;
        if (isIntersecting && !hasStarted.current) {
          hasStarted.current = true;
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return { containerRef, isVisible };
}

export function useTerminalAnimation(isVisible: boolean) {
  const [stepIndex, setStepIndex] = useState(0);
  const [displayedContent, setDisplayedContent] = useState<LineSegment[]>([]);
  const [charIndex, setCharIndex] = useState(0);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [isShowingSpinner, setIsShowingSpinner] = useState(false);

  const currentStep: AnimationStep | undefined = ANIMATION_STEPS[stepIndex];

  useEffect(() => {
    if (!isVisible) return;

    if (!currentStep) {
      const timeout = setTimeout(() => {
        setStepIndex(0);
        setDisplayedContent([]);
        setCharIndex(0);
        setIsShowingSpinner(false);
      }, LOOP_DELAY_MS);
      return () => clearTimeout(timeout);
    }

    if (currentStep.type === 'pause') {
      const timeout = setTimeout(() => {
        setStepIndex((prev) => prev + 1);
      }, currentStep.duration);
      return () => clearTimeout(timeout);
    }

    if (currentStep.type === 'spinner') {
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

    if (currentStep.type === 'type') {
      const fullText = currentStep.lines.map((l) => l.text).join('');
      const totalChars = fullText.length;

      if (charIndex < totalChars) {
        const timeout = setTimeout(() => {
          setCharIndex((prev) => prev + 1);
        }, TYPING_SPEED_MS);
        return () => clearTimeout(timeout);
      }

      setDisplayedContent((prev) => [...prev, ...currentStep.lines]);
      setCharIndex(0);
      setStepIndex((prev) => prev + 1);
    }
  }, [isVisible, stepIndex, charIndex, currentStep]);

  return {
    currentStep,
    displayedContent,
    charIndex,
    spinnerFrame,
    isShowingSpinner,
  };
}
