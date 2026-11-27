import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import type { CopyButtonProps } from "@/types";
import { Button } from "@/components/ui/button";

export const CopyButton = ({ text }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
    const code = text ?? e.currentTarget.closest("figure")?.querySelector("pre code")?.textContent;
    const canCopy = code && navigator.clipboard;
    if (!canCopy) return;

    navigator.clipboard
      .writeText(code)
      .then(() => setCopied(true))
      .catch(() => {});
  };

  const Icon = copied ? Check : Copy;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="mt-1 mr-1 text-muted-foreground transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100 motion-reduce:transition-none"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy code"}
    >
      <Icon />
    </Button>
  );
};
