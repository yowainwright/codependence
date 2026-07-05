import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text?: string;
}

export const CopyButton = ({ text }: CopyButtonProps) => {
  const [isClicked, setIsClicked] = useState(false);

  const getTextToCopy = (button: HTMLButtonElement): string => {
    if (text) return text;
    return button.closest("div")?.querySelector("code")?.textContent ?? "";
  };

  const handleCopy = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    const code = getTextToCopy(target);
    if (!code) return;

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
      .catch(() => {});
  };

  const Icon = isClicked ? Check : Copy;

  return (
    <button className="btn btn-ghost btn-square rounded-s-none" onClick={handleCopy} aria-label="Copy">
      <Icon className="h-5 w-5 pointer-events-none" />
    </button>
  );
};
