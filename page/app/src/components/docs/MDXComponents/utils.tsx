import type { ComponentPropsWithoutRef } from "react";

function externalAnchorProps(
  isExternal: boolean,
): ComponentPropsWithoutRef<"a"> {
  if (!isExternal) return {};

  return {
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

export function Anchor({
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  const isExternal = href?.startsWith("http") ?? false;
  const externalProps = externalAnchorProps(isExternal);

  return (
    <a href={href} {...externalProps} {...props}>
      {children}
    </a>
  );
}
