export interface GlobOptions {
  cwd?: string;
  ignore?: string[];
  absolute?: boolean;
}

export interface PatternPlan {
  pattern: string;
  hasGlobStar: boolean;
}

export interface DirectMatchContext {
  cwd: string;
  ignorePatterns: string[];
}

export interface DirectMatchPlan {
  root: string;
  remainingSegments: string[];
}

export interface DirectMatchStep {
  segment: string;
  isLast: boolean;
}

export interface DirectMatchState {
  candidates: string[];
  results: string[];
}

export type DirectMatchItem =
  | {
      type: "candidate";
      path: string;
    }
  | {
      type: "result";
      path: string;
    };
