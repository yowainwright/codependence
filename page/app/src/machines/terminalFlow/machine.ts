import { assign, createMachine } from "xstate";
import {
  maintenanceModes,
  spotlightSnippets,
  type MaintenanceMode,
  type SpotlightSnippetId,
} from "@/components/home/terminalModel";
import {
  TERMINAL_FLOW_DEFAULTS,
  TERMINAL_FLOW_DELAYS,
  TERMINAL_FLOW_EVENTS,
  TERMINAL_FLOW_MACHINE_IDS,
  TERMINAL_FLOW_STATES,
} from "@/machines/terminalFlow/constants";

type SpotlightContext = {
  activeSnippetId: SpotlightSnippetId;
};

type SpotlightEvent =
  | { type: typeof TERMINAL_FLOW_EVENTS.START }
  | { type: typeof TERMINAL_FLOW_EVENTS.NEXT }
  | { type: typeof TERMINAL_FLOW_EVENTS.SELECT; id: SpotlightSnippetId };

type MaintenanceContext = {
  activeMode: MaintenanceMode;
};

type MaintenanceEvent = {
  type: typeof TERMINAL_FLOW_EVENTS.SELECT_MODE;
  mode: MaintenanceMode;
};

export const spotlightSnippetIds = spotlightSnippets.map(
  (snippet) => snippet.id,
);
export const maintenanceModeIds = maintenanceModes.map((mode) => mode.id);

export function nextSpotlightSnippetId(
  activeSnippetId: SpotlightSnippetId,
): SpotlightSnippetId {
  const index = spotlightSnippetIds.indexOf(activeSnippetId);
  const nextIndex = index >= 0 ? (index + 1) % spotlightSnippetIds.length : 0;
  return spotlightSnippetIds[nextIndex];
}

export const spotlightTerminalMachine = createMachine({
  types: {} as {
    context: SpotlightContext;
    events: SpotlightEvent;
  },
  id: TERMINAL_FLOW_MACHINE_IDS.SPOTLIGHT,
  initial: TERMINAL_FLOW_STATES.IDLE,
  context: {
    activeSnippetId: TERMINAL_FLOW_DEFAULTS.SPOTLIGHT_SNIPPET_ID,
  },
  states: {
    [TERMINAL_FLOW_STATES.IDLE]: {
      on: {
        [TERMINAL_FLOW_EVENTS.START]: TERMINAL_FLOW_STATES.ROTATING,
        [TERMINAL_FLOW_EVENTS.SELECT]: {
          target: TERMINAL_FLOW_STATES.ROTATING,
          actions: assign({
            activeSnippetId: ({ event }) => event.id,
          }),
        },
      },
    },
    [TERMINAL_FLOW_STATES.ROTATING]: {
      after: {
        [TERMINAL_FLOW_DELAYS.SPOTLIGHT_ROTATION_MS]: {
          actions: assign({
            activeSnippetId: ({ context }) =>
              nextSpotlightSnippetId(context.activeSnippetId),
          }),
          reenter: true,
        },
      },
      on: {
        [TERMINAL_FLOW_EVENTS.NEXT]: {
          actions: assign({
            activeSnippetId: ({ context }) =>
              nextSpotlightSnippetId(context.activeSnippetId),
          }),
        },
        [TERMINAL_FLOW_EVENTS.SELECT]: {
          actions: assign({
            activeSnippetId: ({ event }) => event.id,
          }),
        },
      },
    },
  },
});

export const maintenanceModeMachine = createMachine({
  types: {} as {
    context: MaintenanceContext;
    events: MaintenanceEvent;
  },
  id: TERMINAL_FLOW_MACHINE_IDS.MAINTENANCE_MODE,
  initial: TERMINAL_FLOW_STATES.READY,
  context: {
    activeMode: TERMINAL_FLOW_DEFAULTS.MAINTENANCE_MODE,
  },
  states: {
    [TERMINAL_FLOW_STATES.READY]: {
      on: {
        [TERMINAL_FLOW_EVENTS.SELECT_MODE]: {
          actions: assign({
            activeMode: ({ event }) => event.mode,
          }),
        },
      },
    },
  },
});
