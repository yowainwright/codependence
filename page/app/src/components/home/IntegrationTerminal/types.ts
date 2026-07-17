export type LineSegment = {
  text: string;
  color: string;
};

export type TypeStep = {
  type: "type";
  lines: LineSegment[];
};

export type SpinnerStep = {
  type: "spinner";
  duration: number;
  text: string;
};

export type PauseStep = {
  type: "pause";
  duration: number;
};

export type AnimationStep = TypeStep | SpinnerStep | PauseStep;

export type SegmentProps = {
  segment: LineSegment;
  keyPrefix: string;
  index: number;
};

export type SpinnerProps = {
  frame: number;
  text: string;
};

export type TypingContentProps = {
  step: TypeStep;
  charIndex: number;
};

export type TerminalContentProps = {
  displayedContent: LineSegment[];
  currentStep: AnimationStep | undefined;
  charIndex: number;
  spinnerFrame: number;
  isShowingSpinner: boolean;
};
