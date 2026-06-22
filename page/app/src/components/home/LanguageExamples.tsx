import { useMemo } from "react";
import { useMachine } from "@xstate/react";
import {
  LANGUAGE_TERMINAL_CONTENT_CLASS,
  TERMINAL_FRAME_CLASS,
  TerminalTranscript,
  TerminalWindow,
  type TerminalLine,
} from "@/components/TerminalWindow";
import {
  createLanguageTranscript,
  languages,
  maintenanceModes,
  type MaintenanceMode,
} from "@/components/home/terminalModel";
import { TERMINAL_FLOW_EVENTS } from "@/machines/terminalFlow/constants";
import { maintenanceModeMachine } from "@/machines/terminalFlow/machine";

export function LanguageExamples() {
  const [snapshot, send] = useMachine(maintenanceModeMachine);
  const activeMode = snapshot.context.activeMode;

  const languageTranscripts = useMemo(
    () =>
      languages.map((language) => ({
        ...language,
        lines: createLanguageTranscript(language, activeMode),
      })),
    [activeMode],
  );

  return (
    <section
      data-section="language-maintenance"
      className="border-y border-base-content/10 bg-base-100 px-4 py-16 sm:px-6 lg:px-10 xl:px-8 2xl:px-16"
    >
      <div className="mx-auto max-w-[88rem]">
        <header className="max-w-3xl">
          <h2 className="text-3xl font-black sm:text-5xl">
            Same maintenance flow for{" "}
            <span className="gradient-text">every provider</span>
          </h2>
          <p className="mt-5 text-lg leading-8 text-base-content/75">
            Switch between check, dry-run, and update mode to see Codependence
            execute the same dependency policy workflow against Node.js, Python,
            and Go manifests.
          </p>
        </header>

        <div className="mt-8 inline-flex max-w-full overflow-x-auto rounded-md border border-base-content/10 bg-base-200/60 p-1">
          {maintenanceModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() =>
                send({ type: TERMINAL_FLOW_EVENTS.SELECT_MODE, mode: mode.id })
              }
              aria-pressed={activeMode === mode.id}
              className={
                activeMode === mode.id ? "terminal-tab active" : "terminal-tab"
              }
            >
              {mode.title}
            </button>
          ))}
        </div>

        <div className="mt-10 grid justify-items-start gap-6 lg:grid-cols-2">
          {languageTranscripts.map((language) => (
            <LanguageTerminal
              key={language.id}
              title={language.title}
              lines={language.lines}
              mode={activeMode}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function LanguageTerminal({
  title,
  lines,
  mode,
}: {
  title: string;
  lines: TerminalLine[];
  mode: MaintenanceMode;
}) {
  return (
    <article className={TERMINAL_FRAME_CLASS}>
      <TerminalWindow fileName={title}>
        <TerminalTranscript
          lines={lines}
          className={LANGUAGE_TERMINAL_CONTENT_CLASS}
          contentKey={`${title}-${mode}`}
        />
      </TerminalWindow>
    </article>
  );
}
