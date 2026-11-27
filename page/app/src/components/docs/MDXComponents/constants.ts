import { Anchor, CodeBlock } from "./utils";
import { CodeDemo } from "../CodeDemo";
import { DocBlockquote } from "./DocBlockquote";

export const MDX_COMPONENTS = {
  CodeDemo,
  blockquote: DocBlockquote,
  a: Anchor,
  pre: CodeBlock,
};
