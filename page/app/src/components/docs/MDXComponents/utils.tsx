import { isValidElement, type ComponentPropsWithoutRef } from "react";
import { CopyButton } from "@/components/common/CopyButton";
import { resolveUrl } from "@/utils/urlResolver";

function externalAnchorProps(isExternal: boolean): ComponentPropsWithoutRef<"a"> {
  if (!isExternal) return {};

  return {
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

export function Anchor({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  const isExternal = href?.startsWith("http") ?? false;
  const externalProps = externalAnchorProps(isExternal);
  const url = href?.startsWith("/docs/") ? resolveUrl(href) : href;

  return (
    <a href={url} {...externalProps} {...props}>
      {children}
    </a>
  );
}

const terminalLanguages = new Set(["ansi", "bash", "console", "plaintext", "shell", "shellscript", "sh", "terminal", "text"]);

type CodeBlockProps = ComponentPropsWithoutRef<"pre"> & { "data-title"?: string };

export function CodeBlock({ children, "data-title": title, ...props }: CodeBlockProps) {
  const code = isValidElement<{ className?: string }>(children) ? children.props : undefined;
  const language = code?.className?.replace(/^language-/, "") || "text";
  const numbering = terminalLanguages.has(language) ? "" : "show-line-numbers";
  return (
    <figure aria-label={title ?? `${language} code`} className={`shiki-wrapper not-prose group my-4 min-w-0 overflow-hidden rounded-md border border-border/70 ${numbering}`}>
      {title && (
        <figcaption className="shiki-header flex items-center justify-between gap-3 border-b border-border/70 px-3 py-2 text-xs font-medium">
          {title}
          <CopyButton />
        </figcaption>
      )}
      <div className="flex items-start">
        <div className="min-w-0 flex-1 overflow-x-auto p-2">
          <pre {...props}>{children}</pre>
        </div>
        {!title && <CopyButton />}
      </div>
    </figure>
  );
}
