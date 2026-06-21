import { assign, createMachine } from "xstate";

interface SearchContext {
  query: string;
}

type SearchEvent =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "SET_QUERY"; query: string };

export const searchMachine = createMachine({
  types: {} as {
    context: SearchContext;
    events: SearchEvent;
  },
  id: "docsSearch",
  initial: "closed",
  context: {
    query: "",
  },
  states: {
    closed: {
      on: {
        OPEN: "open",
      },
    },
    open: {
      on: {
        CLOSE: {
          target: "closed",
          actions: assign({ query: "" }),
        },
        SET_QUERY: {
          actions: assign({
            query: ({ event }) => event.query,
          }),
        },
      },
    },
  },
});
