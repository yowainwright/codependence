import { useEffect, useRef } from "react";
import { useMachine } from "@xstate/react";
import {
  SPOTLIGHT_TERMINAL_CONTENT_CLASS,
  TERMINAL_FRAME_CLASS,
  getSpotlightSnippet,
  spotlightSnippets,
  type SpotlightSnippetId,
} from "@/components/home/terminalModel";
import { TerminalWindow } from "@/components/home/terminalTranscript";
import { TERMINAL_FLOW_EVENTS } from "@/machines/terminalFlow/constants";
import { spotlightTerminalMachine } from "@/machines/terminalFlow/machine";

export function SpotlightCode() {
  const [snapshot, send] = useMachine(spotlightTerminalMachine);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSnippet = getSpotlightSnippet(snapshot.context.activeSnippetId);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting)
          send({ type: TERMINAL_FLOW_EVENTS.START });
      },
      { threshold: 0.25 },
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [send]);

  const switchTabById = (id: string) => {
    if (spotlightSnippets.some((snippet) => snippet.id === id)) {
      send({ type: TERMINAL_FLOW_EVENTS.SELECT, id: id as SpotlightSnippetId });
    }
  };

  return (
    <div ref={containerRef} className={TERMINAL_FRAME_CLASS}>
      <TerminalWindow
        title="terminal"
        lines={activeSnippet.lines}
        tabs={spotlightSnippets.map(({ id, title }) => ({ id, title }))}
        activeTabId={activeSnippet.id}
        onTabClick={switchTabById}
        contentClassName={SPOTLIGHT_TERMINAL_CONTENT_CLASS}
        contentKey={activeSnippet.id}
      />
    </div>
  );
}
