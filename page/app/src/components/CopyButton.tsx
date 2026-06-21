import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 900);
  };

  const Icon = copied ? Check : Copy;

  return (
    <button
      className={`btn btn-sm btn-ghost btn-circle ${className}`}
      onClick={handleCopy}
      aria-label="Copy command"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
