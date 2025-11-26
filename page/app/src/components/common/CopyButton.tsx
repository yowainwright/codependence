import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export const CopyButton = () => {
  const [isClicked, setIsClicked] = useState(false);

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    const codeElement = target.closest("div")?.querySelector("code");

    if (!codeElement) {
      console.log("Code not found");
      return;
    }

    const code = codeElement.textContent || "";

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(code)
        .then(() => {
          setIsClicked(true);
          target.disabled = true;
          setTimeout(() => {
            setIsClicked(false);
            target.disabled = false;
          }, 800);
        })
        .catch((error) => {
          console.error("Failed to save text to clipboard:", error);
        });
    } else {
      console.error("Clipboard API is not supported");
    }
  };

  const Icon = isClicked ? Check : Copy;

  return (
    <button
      className="btn btn-ghost btn-square rounded-s-none"
      onClick={handleCopy}
      aria-label="Copy"
    >
      <Icon className="h-5 w-5 pointer-events-none" />
    </button>
  );
};
