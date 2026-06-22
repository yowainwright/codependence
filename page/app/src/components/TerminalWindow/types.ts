import type { ReactNode } from "react";

export type AnsiColor = "cyan" | "gray" | "green" | "red" | "yellow";

export type TerminalSegment = {
  text: string;
  className?: string;
  ansiColor?: AnsiColor;
};

export type TerminalLine = TerminalSegment[];

export type SegmentEntry = [
  text: string,
  className?: string,
  ansiColor?: AnsiColor,
];

export interface TerminalTab {
  id: string;
  label: string;
}

export interface TerminalWindowProps {
  fileName?: string;
  tabs?: TerminalTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  hideHeader?: boolean;
  footer?: ReactNode;
  footerClassName?: string;
  children: ReactNode;
  className?: string;
}

export interface TerminalTranscriptProps {
  lines: TerminalLine[];
  className?: string;
  contentKey?: string;
}
