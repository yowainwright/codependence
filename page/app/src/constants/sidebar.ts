import { resolveDocsUrl } from "../utils/urlResolver";

const SIDEBAR = [
  {
    title: "Getting Started",
    items: [
      {
        title: "Introduction",
        href: resolveDocsUrl("introduction"),
      },
      {
        title: "Main Use Case",
        href: resolveDocsUrl("main-usecase"),
      },
    ],
  },

  {
    title: "Usage",
    items: [
      {
        title: "CLI",
        href: resolveDocsUrl("cli"),
      },
      {
        title: "Node.js",
        href: resolveDocsUrl("node"),
      },
      {
        title: "Options",
        href: resolveDocsUrl("options"),
      },
      {
        title: "Usage Examples",
        href: resolveDocsUrl("usage"),
      },
    ],
  },

  {
    title: "Advanced",
    items: [
      {
        title: "Recipes",
        href: resolveDocsUrl("recipes"),
      },
    ],
  },
];

export default SIDEBAR;
