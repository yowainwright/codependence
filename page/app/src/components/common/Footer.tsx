import { FaGithub } from "react-icons/fa";
import { resolveUrl } from "@/utils/urlResolver";
import { GITHUB_URL } from "@/constants";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <footer className="grid h-16 w-full shrink-0 grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-surface-raised px-4 font-sans sm:grid-cols-[1fr_auto_1fr] sm:px-6 md:px-10 xl:px-28">
      <p className="text-sm sm:text-base">
        Copyright &copy; {new Date().getFullYear()} - All rights reserved
      </p>

      <img
        src={resolveUrl("logos/codependence.svg")}
        alt="Codependence Logo"
        className="size-12"
      />

      <nav className="justify-self-end">
        <Button
          variant="ghost"
          size="icon"
          className="size-12"
          render={
            <a
              href={GITHUB_URL}
              aria-label="GitHub"
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <FaGithub size={20} />
        </Button>
      </nav>
    </footer>
  );
}
