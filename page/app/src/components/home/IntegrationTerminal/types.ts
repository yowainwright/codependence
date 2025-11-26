export type LineSegment = {
  text: string;
  color: string;
};

export type TypeStep = {
  type: 'type';
  lines: LineSegment[];
};

export type SpinnerStep = {
  type: 'spinner';
  duration: number;
  text: string;
};

export type PauseStep = {
  type: 'pause';
  duration: number;
};

export type AnimationStep = TypeStep | SpinnerStep | PauseStep;
