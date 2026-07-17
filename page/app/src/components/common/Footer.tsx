import { FaGithub } from "react-icons/fa";
import { resolveUrl } from "@/utils/urlResolver";
import { GITHUB_URL } from "@/constants";

export function Footer() {
  return (
    <footer className="w-full px-4 sm:px-6 md:px-10 xl:px-28 py-6 sm:py-7 border-t border-base-300 flex flex-col gap-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:items-center font-sans">
      <div className="flex items-center justify-center sm:justify-start gap-2 order-3 sm:order-1">
        <p className="text-sm sm:text-base text-center sm:text-left">
          Copyright &copy; {new Date().getFullYear()} - All rights reserved
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 order-1 sm:order-2">
        <img
          src={resolveUrl("logos/codependence.svg")}
          alt="Codependence Logo"
          className="h-12 w-12"
        />
      </div>

      <nav className="flex justify-center sm:justify-end order-2 sm:order-3">
        <div className="grid grid-flow-col gap-4">
          <a
            className="btn btn-ghost btn-circle flex items-center justify-center"
            href={GITHUB_URL}
            aria-label="GitHub"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaGithub className="h-5 w-5" />
          </a>
        </div>
      </nav>
    </footer>
  );
}
