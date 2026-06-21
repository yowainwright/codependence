/// <reference types="vite/client" />

declare module "*.mdx" {
  import type { ComponentType } from "react";

  const component: ComponentType<{
    components?: Record<string, ComponentType>;
  }>;

  export default component;
}
