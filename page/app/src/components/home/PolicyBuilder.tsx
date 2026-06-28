import type { ChangeEvent } from "react";
import {
  FileJson2,
  GitBranch,
  Loader2,
  Search,
  TerminalSquare,
} from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import {
  labelForLanguage,
  languageOptions,
  outputTabs,
  type LanguageId,
  type OutputTab,
  type PolicyMode,
  type ScanStatus,
} from "./policyBuilderModel";
import { usePolicyBuilder, type PolicyBuilderState } from "./usePolicyBuilder";

type PatchState = (patch: Partial<PolicyBuilderState>) => void;
type Builder = ReturnType<typeof usePolicyBuilder>;

export function PolicyBuilder() {
  const builder = usePolicyBuilder();

  return (
    <section className="w-full min-w-0 rounded-lg border border-base-content/10 bg-base-100 shadow-xl shadow-base-content/5">
      <PolicyBuilderHeader />
      <PolicyBuilderBody builder={builder} />
    </section>
  );
}

function PolicyBuilderHeader() {
  return (
    <header className="border-b border-base-content/10 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <HeaderIcon />
        <HeaderText />
      </div>
    </header>
  );
}

function HeaderIcon() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-content">
      <GitBranch className="h-5 w-5" />
    </div>
  );
}

function HeaderText() {
  return (
    <div className="min-w-0">
      <h2 className="text-lg font-black">Policy builder</h2>
      <p className="text-sm text-base-content/65">
        Design here. Enforce with CLI or GitHub Actions.
      </p>
    </div>
  );
}

function PolicyBuilderBody({ builder }: { builder: Builder }) {
  const { dependencies, output, patchState, scanRepository, state } = builder;
  const label = labelForLanguage(state.language);
  const summary = `${label} policy from ${dependencies.length} dependency names.`;

  return (
    <div className="grid gap-4 p-4 sm:p-5">
      <RepositoryScanner
        state={state}
        patchState={patchState}
        scanRepository={scanRepository}
      />
      <PolicySelectors state={state} patchState={patchState} />
      <DependencyInput state={state} patchState={patchState} />
      <OutputPanel output={output} state={state} patchState={patchState} />
      <p className="text-xs leading-5 text-base-content/55">{summary}</p>
    </div>
  );
}

function RepositoryScanner({
  state,
  patchState,
  scanRepository,
}: {
  state: PolicyBuilderState;
  patchState: PatchState;
  scanRepository: () => Promise<void>;
}) {
  const isScanning = state.scanStatus === "scanning";

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold" htmlFor="repo-url">
        Repository
      </label>
      <div className="flex min-w-0 gap-2">
        <RepositoryInput state={state} patchState={patchState} />
        <ScanButton isScanning={isScanning} scanRepository={scanRepository} />
      </div>
      <StatusMessage status={state.scanStatus} text={state.statusText} />
    </div>
  );
}

function RepositoryInput({
  state,
  patchState,
}: {
  state: PolicyBuilderState;
  patchState: PatchState;
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    patchState({ repoUrl: event.target.value });
  };

  return (
    <input
      id="repo-url"
      type="text"
      value={state.repoUrl}
      onChange={handleChange}
      placeholder="yowainwright/codependence"
      className="input input-bordered min-w-0 flex-1 rounded-lg"
    />
  );
}

function ScanButton({
  isScanning,
  scanRepository,
}: {
  isScanning: boolean;
  scanRepository: () => Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={scanRepository}
      className="btn btn-primary rounded-lg"
      disabled={isScanning}
    >
      <ScanButtonIcon isScanning={isScanning} />
      Scan
    </button>
  );
}

function ScanButtonIcon({ isScanning }: { isScanning: boolean }) {
  if (isScanning) return <Loader2 className="h-4 w-4 animate-spin" />;
  return <Search className="h-4 w-4" />;
}

function StatusMessage({ status, text }: { status: ScanStatus; text: string }) {
  if (!text) return null;
  const className = statusClassName(status);
  return <p className={className}>{text}</p>;
}

const statusClassName = (status: ScanStatus): string => {
  if (status === "error") return "text-xs text-error";
  if (status === "success") return "text-xs text-success";
  return "text-xs text-base-content/55";
};

function PolicySelectors({
  state,
  patchState,
}: {
  state: PolicyBuilderState;
  patchState: PatchState;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <LanguageSelect language={state.language} patchState={patchState} />
      <ModeSelect mode={state.mode} patchState={patchState} />
    </div>
  );
}

function LanguageSelect({
  language,
  patchState,
}: {
  language: LanguageId;
  patchState: PatchState;
}) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    patchState({ language: event.target.value as LanguageId });
  };
  const options = languageOptions.map((option) => (
    <option key={option.id} value={option.id}>
      {option.label} - {option.manifest}
    </option>
  ));

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold" htmlFor="policy-language">
        Manifest
      </label>
      <select
        id="policy-language"
        value={language}
        onChange={handleChange}
        className="select select-bordered rounded-lg"
      >
        {options}
      </select>
    </div>
  );
}

function ModeSelect({
  mode,
  patchState,
}: {
  mode: PolicyMode;
  patchState: PatchState;
}) {
  const isPinExceptions = mode === "pin-exceptions";
  const isPinListed = mode === "pin-listed";

  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold">Mode</span>
      <div className="join w-full">
        <ModeButton
          active={isPinExceptions}
          mode="pin-exceptions"
          patchState={patchState}
        >
          Pin exceptions
        </ModeButton>
        <ModeButton
          active={isPinListed}
          mode="pin-listed"
          patchState={patchState}
        >
          Only listed
        </ModeButton>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  children,
  mode,
  patchState,
}: {
  active: boolean;
  children: string;
  mode: PolicyMode;
  patchState: PatchState;
}) {
  const handleClick = () => patchState({ mode });
  const className = modeButtonClassName(active);

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}

const modeButtonClassName = (isActive: boolean): string => {
  const base = "btn join-item min-w-0 flex-1 rounded-lg";
  if (isActive) return `${base} btn-primary`;
  return `${base} btn-outline`;
};

function DependencyInput({
  state,
  patchState,
}: {
  state: PolicyBuilderState;
  patchState: PatchState;
}) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    patchState({ dependencyInput: event.target.value });
  };

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold" htmlFor="dependencies">
        Policy dependencies
      </label>
      <textarea
        id="dependencies"
        value={state.dependencyInput}
        onChange={handleChange}
        className="textarea textarea-bordered min-h-24 rounded-lg font-mono text-sm"
      />
    </div>
  );
}

function OutputPanel({
  output,
  state,
  patchState,
}: {
  output: string;
  state: PolicyBuilderState;
  patchState: PatchState;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-base-content/10">
      <OutputHeader output={output} tab={state.tab} patchState={patchState} />
      <pre className="h-56 overflow-auto bg-base-200/70 p-4 text-xs leading-5">
        <code>{output}</code>
      </pre>
    </div>
  );
}

function OutputHeader({
  output,
  tab,
  patchState,
}: {
  output: string;
  tab: OutputTab;
  patchState: PatchState;
}) {
  const buttons = outputTabs.map((item) => {
    const active = tab === item.id;
    return (
      <OutputTabButton
        key={item.id}
        item={item}
        active={active}
        patchState={patchState}
      />
    );
  });

  return (
    <div className="flex items-center justify-between gap-2 border-b border-base-content/10 bg-base-100 p-2">
      <div className="join min-w-0 overflow-x-auto">{buttons}</div>
      <CopyButton text={output} />
    </div>
  );
}

function OutputTabButton({
  active,
  item,
  patchState,
}: {
  active: boolean;
  item: { id: OutputTab; label: string };
  patchState: PatchState;
}) {
  const handleClick = () => patchState({ tab: item.id });
  const className = outputTabClassName(active);

  return (
    <button type="button" onClick={handleClick} className={className}>
      <OutputIcon id={item.id} />
      {item.label}
    </button>
  );
}

function OutputIcon({ id }: { id: OutputTab }) {
  if (id === "cli") return <TerminalSquare className="h-3.5 w-3.5" />;
  if (id === "action") return <GitBranch className="h-3.5 w-3.5" />;
  return <FileJson2 className="h-3.5 w-3.5" />;
}

const outputTabClassName = (isActive: boolean): string => {
  const base = "btn btn-xs join-item rounded-md";
  if (isActive) return `${base} btn-primary`;
  return `${base} btn-ghost`;
};
