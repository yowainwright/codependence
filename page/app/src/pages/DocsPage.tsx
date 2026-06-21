import { useEffect, useState } from "react";
import { Effect } from "effect";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import { getDocBySlug, getPagination, loadDoc, type LoadedDoc } from "@/content";
import { Pagination } from "@/components/docs/Pagination";
import { Toc } from "@/components/docs/Toc";

export function DocsPage() {
  const { slug } = useParams({ from: "/docs/$slug" });
  const doc = getDocBySlug(slug);
  const [loadedDoc, setLoadedDoc] = useState<LoadedDoc | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadedDoc(null);
    setError(null);

    Effect.runPromise(loadDoc(slug))
      .then((result) => {
        if (!cancelled) setLoadedDoc(result);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError : new Error(String(loadError)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!doc) return;
    document.title = `${doc.title} | Codependence`;
  }, [doc]);

  if (!doc) {
    return <Navigate to="/docs/$slug" params={{ slug: "introduction" }} />;
  }

  const { prevItem, nextItem } = getPagination(slug);
  const Content = loadedDoc?.Content;

  return (
    <section className="flex flex-col gap-8 p-4 sm:p-6 md:p-10 lg:flex-row">
      <article className="flex w-full max-w-[680px] flex-col">
        <Breadcrumbs title={doc.title} />

        <section className="docs-prose prose prose-sm mb-10 max-w-none sm:prose-base md:prose-lg">
          <header>
            <h1>{doc.title}</h1>
            <p>{doc.description}</p>
          </header>

          <div className="not-prose my-6 border-t border-base-content/10" />

          {!Content && !error && (
            <section className="not-prose flex items-center justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </section>
          )}

          {error && (
            <section className="not-prose rounded-lg border border-error/30 bg-error/10 p-4 text-error">
              {error.message}
            </section>
          )}

          {Content && <Content />}
        </section>

        <div className="border-t border-base-content/10 pt-6">
          <Pagination prevItem={prevItem} nextItem={nextItem} />
        </div>
      </article>

      <aside className="hidden xl:block">
        <Toc headings={loadedDoc?.headings ?? []} />
      </aside>
    </section>
  );
}

function Breadcrumbs({ title }: { title: string }) {
  return (
    <nav className="breadcrumbs pb-4 text-sm">
      <ul>
        <li>
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
        </li>
        <li className="text-primary">{title}</li>
      </ul>
    </nav>
  );
}
