import { describe, expect, test } from "bun:test";
import { createActor } from "xstate";
import {
  TERMINAL_FLOW_DEFAULTS,
  TERMINAL_FLOW_EVENTS,
  TERMINAL_FLOW_MACHINE_IDS,
  TERMINAL_FLOW_STATES,
} from "../../../page/app/src/machines/terminalFlow/constants";
import {
  maintenanceModeMachine,
  nextSpotlightSnippetId,
  spotlightTerminalMachine,
} from "../../../page/app/src/machines/terminalFlow/machine";

describe("terminal flow machines", () => {
  test("keeps machine literals in constants", () => {
    expect(spotlightTerminalMachine.id).toBe(
      TERMINAL_FLOW_MACHINE_IDS.SPOTLIGHT,
    );
    expect(maintenanceModeMachine.id).toBe(
      TERMINAL_FLOW_MACHINE_IDS.MAINTENANCE_MODE,
    );
  });

  test("cycles spotlight snippets in a stable order", () => {
    expect(nextSpotlightSnippetId("check")).toBe("dry-run");
    expect(nextSpotlightSnippetId("dry-run")).toBe("update");
    expect(nextSpotlightSnippetId("update")).toBe("check");
  });

  test("moves spotlight from idle to rotating and updates the active snippet", () => {
    const actor = createActor(spotlightTerminalMachine).start();

    expect(actor.getSnapshot().matches(TERMINAL_FLOW_STATES.IDLE)).toBe(true);
    expect(actor.getSnapshot().context.activeSnippetId).toBe(
      TERMINAL_FLOW_DEFAULTS.SPOTLIGHT_SNIPPET_ID,
    );

    actor.send({ type: TERMINAL_FLOW_EVENTS.START });
    expect(actor.getSnapshot().matches(TERMINAL_FLOW_STATES.ROTATING)).toBe(
      true,
    );

    actor.send({ type: TERMINAL_FLOW_EVENTS.SELECT, id: "update" });
    expect(actor.getSnapshot().context.activeSnippetId).toBe("update");

    actor.send({ type: TERMINAL_FLOW_EVENTS.NEXT });
    expect(actor.getSnapshot().context.activeSnippetId).toBe("check");

    actor.stop();
  });

  test("shares maintenance mode through a small XState actor", () => {
    const actor = createActor(maintenanceModeMachine).start();

    expect(actor.getSnapshot().matches(TERMINAL_FLOW_STATES.READY)).toBe(true);
    expect(actor.getSnapshot().context.activeMode).toBe(
      TERMINAL_FLOW_DEFAULTS.MAINTENANCE_MODE,
    );

    actor.send({ type: TERMINAL_FLOW_EVENTS.SELECT_MODE, mode: "update" });
    expect(actor.getSnapshot().context.activeMode).toBe("update");

    actor.stop();
  });
});
