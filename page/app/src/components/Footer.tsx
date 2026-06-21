import { Link } from "@tanstack/react-router";
import { GithubIcon } from "@/components/icons/GithubIcon";

export function Footer() {
  return (
    <footer className="w-full border-t border-base-content/10 px-4 py-6 sm:grid sm:grid-cols-3 sm:items-center sm:px-6 md:px-10 xl:px-28">
      <p className="order-3 text-center text-sm text-base-content/70 sm:order-1 sm:text-left sm:text-base">
        Copyright © {new Date().getFullYear()} - All rights reserved
      </p>

      <div className="order-1 flex justify-center sm:order-2">
        <Link to="/" className="transition-opacity hover:opacity-80">
          <img
            src={`${import.meta.env.BASE_URL}logos/codependence.svg`}
            alt="Codependence"
            className="h-12 w-12"
          />
        </Link>
      </div>

      <nav className="order-2 flex justify-center sm:order-3 sm:justify-end">
        <a
          className="btn btn-ghost btn-circle"
          href="https://github.com/yowainwright/codependence"
          aria-label="GitHub"
          target="_blank"
          rel="noreferrer"
        >
          <GithubIcon className="h-5 w-5" />
        </a>
      </nav>
    </footer>
  );
}
