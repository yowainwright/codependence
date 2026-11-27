import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Tooltip } from "@base-ui/react/tooltip";

const calloutCollisions = { side: "none", align: "none", fallbackAxisSide: "none" } as const;

interface DemoStep {
  line: number;
  label: string;
  note: string;
}

export interface CodeDemoProps {
  label: string;
  steps: [DemoStep, ...DemoStep[]];
  children: ReactNode;
}

function candidateFor(block: HTMLElement) {
  const { top, height } = block.getBoundingClientRect();
  const count = Number(block.dataset.steps);
  const midpoint = (top + height / 2) / window.innerHeight;
  const outsideReadingArea = midpoint <= 0.1 || midpoint >= 0.95;
  if (outsideReadingArea) return null;
  const index = Math.floor((0.75 - midpoint) / 0.5 * count);
  const selected = Math.max(0, Math.min(index, count - 1));
  const distance = Math.abs(midpoint - 0.5);
  return { block, selected, distance };
}

function observeBlock(element: HTMLElement, update: () => void) {
  const observer = new ResizeObserver(update);
  observer.observe(element);
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
  return () => {
    observer.disconnect();
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
  };
}

type Selection = { block: HTMLElement; selected: number };
type Walkthrough = { active: Selection | null; select: (selection: Selection) => void };
const WalkthroughContext = createContext<Walkthrough | null>(null);

function sameSelection(a: Selection | null, b: Selection | null) {
  const unchanged = a?.block === b?.block && a?.selected === b?.selected;
  return unchanged;
}

export function CodeDemoProvider({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [active, select] = useState<Selection | null>(null);

  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const blocks = Array.from(element.querySelectorAll<HTMLElement>(".demo-code"));
    if (!blocks.length) return;
    let previous: Selection | null = null;
    const update = () => {
      const candidates = blocks.map(candidateFor).filter((item) => item !== null);
      const next = candidates.toSorted((a, b) => a.distance - b.distance)[0] ?? null;
      if (sameSelection(previous, next)) return;
      previous = next;
      select(next);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") select(null);
    };
    const stopObserving = observeBlock(element, update);
    window.addEventListener("keydown", escape, true);
    return () => {
      stopObserving();
      window.removeEventListener("keydown", escape, true);
    };
  }, []);

  return (
    <WalkthroughContext.Provider value={{ active, select }}>
      <div ref={content}>{children}</div>
    </WalkthroughContext.Provider>
  );
}

function lineAnchor(line: HTMLElement, block: HTMLElement) {
  const scope = line.closest("code.language-diff") ? line : block;
  const tokens = scope.querySelectorAll<HTMLElement>(".line > span:last-child");
  const getBoundingClientRect = () => {
    const { top, height, left } = line.getBoundingClientRect();
    const ends = Array.from(tokens, (token) => token.getBoundingClientRect().right);
    const right = Math.max(left, ...ends);
    return new DOMRect(right, top, 0, height);
  };
  return { contextElement: line, getBoundingClientRect };
}

function LineTooltip({ anchor, boundary, step }: {
  anchor: ReturnType<typeof lineAnchor>;
  boundary: HTMLElement;
  step: DemoStep;
}) {
  const onPopup = useCallback((popup: HTMLDivElement | null) => {
    const shouldAnimate = popup && !boundary.hasAttribute("data-callout-seen");
    if (!shouldAnimate) return;
    popup.setAttribute("data-enter", "");
    boundary.setAttribute("data-callout-seen", "");
  }, [boundary]);
  return (
    <Tooltip.Root open>
      <Tooltip.Portal>
        <Tooltip.Positioner anchor={anchor} side="right" align="center" sideOffset={12}
          collisionBoundary={boundary} collisionAvoidance={calloutCollisions} collisionPadding={8}
          className="pointer-events-none z-40 hidden w-[min(16rem,var(--available-width))] pointer-fine:md:block data-[anchor-hidden]:invisible">
          <Tooltip.Popup ref={onPopup} role="tooltip" className="demo-tooltip relative rounded-md px-3 py-2 text-sm leading-5 text-popover-foreground shadow-md">
            {step.note}
            <Tooltip.Arrow className="demo-tooltip-arrow" />
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function connectDemoLines(block: HTMLElement, steps: DemoStep[], noteId: string, select: Walkthrough["select"]) {
  const lines = block.querySelectorAll<HTMLElement>(".shiki code > .line");
  const events = new AbortController();
  const annotated = steps.map(({ line }) => lines[line - 1]);
  annotated.forEach((line, index) => {
    if (!line) return;
    line.tabIndex = 0;
    line.setAttribute("aria-describedby", `${noteId}-${index}`);
    const activate = () => select({ block, selected: index });
    line.addEventListener("focus", activate, { signal: events.signal });
    line.addEventListener("click", activate, { signal: events.signal });
  });
  return () => {
    events.abort();
    annotated.forEach((line) => {
      line?.removeAttribute("tabindex");
      line?.removeAttribute("aria-describedby");
    });
  };
}

export function CodeDemo({ label, steps, children }: CodeDemoProps) {
  const block = useRef<HTMLDivElement>(null);
  const walkthrough = useContext(WalkthroughContext);
  const active = walkthrough?.active;
  const ownsCallout = !!active && active.block === block.current;
  const selected = ownsCallout ? active.selected : -1;
  const select = walkthrough?.select;
  const step = steps[selected] ?? steps[0];
  const noteId = useId();
  const [anchor, setAnchor] = useState<ReturnType<typeof lineAnchor> | null>(null);

  useEffect(() => {
    const element = block.current;
    if (!element) return;
    if (select) return connectDemoLines(element, steps, noteId, select);
  }, [noteId, select, steps]);

  useLayoutEffect(() => {
    const selector = `.shiki code > .line:nth-child(${step.line})`;
    const line = block.current?.querySelector<HTMLElement>(selector);
    const boundary = block.current;
    const show = ownsCallout && line && boundary;
    if (!show) return;
    line.setAttribute("data-demo-active", "");
    setAnchor(lineAnchor(line, boundary));
    return () => line.removeAttribute("data-demo-active");
  }, [ownsCallout, step.line]);

  return (
    <section aria-label={label} className="not-prose my-4">
      <div ref={block} data-steps={steps.length} className="demo-code [&_figure]:my-2">{children}</div>
      {steps.map((item, index) => (
        <p key={item.line} id={`${noteId}-${index}`} hidden={selected !== index}
          className="text-sm text-muted-foreground pointer-fine:md:sr-only">{item.note}</p>
      ))}
      {ownsCallout && anchor && block.current && <LineTooltip anchor={anchor} boundary={block.current} step={step} />}
    </section>
  );
}
