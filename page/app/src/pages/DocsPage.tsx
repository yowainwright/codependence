import { useState, useEffect, useRef } from "react";
import { useParams, Link, Navigate } from "@tanstack/react-router";
import { getDocBySlug, getDocComponent, type DocComponent } from "@/content";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { mdxComponents } from "@/components/docs/MDXComponents";
import { Pagination } from "@/components/docs/Pagination";
import type { BreadcrumbsProps, MdxContentProps } from "@/types";
import { Separator } from "@/components/ui/separator";
import { ChevronRightIcon } from "@/components/common/Icons";

function useDocContent(slug: string) {
  const doc = getDocBySlug(slug);

  const [Content, setContent] = useState<DocComponent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!doc) {
        setLoading(false);
        return;
      }

      const MDXContent = await getDocComponent(slug);

      if (cancelled) return;

      setContent(() => MDXContent ?? null);
      setLoading(false);
    }

    setLoading(true);
    load().catch(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [slug, doc]);

  return { doc, Content, loading };
}

export function DocsPage() {
  const { slug } = useParams({ from: "/docs/$slug" });
  const { doc, Content, loading } = useDocContent(slug);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (doc) document.title = `${doc.title} | Codependence`;
  }, [doc]);

  if (!doc) return <Navigate to="/docs/$slug" params={{ slug: "introduction" }} />;

  return (
    <div className="grid w-full min-w-0 max-w-[1240px] grid-cols-1 gap-x-10 px-4 sm:px-6 md:px-10 xl:grid-cols-[minmax(0,1fr)_15rem]">
      <main className="mx-auto w-full min-w-0 max-w-[720px] py-4 md:py-6">
        <Breadcrumbs title={doc.title} />
        <article ref={articleRef} className="docs-prose prose prose-base max-w-none break-words md:text-lg md:leading-7 dark:prose-invert prose-headings:scroll-mt-24 prose-a:text-primary">
          <header>
            <h1>{doc.title}</h1>
            <p>{doc.description}</p>
          </header>
          <Separator className="my-4" />
          <MDXContent loading={loading} Content={Content} />
        </article>
        <Separator className="my-6" />
        <Pagination slug={slug} />
      </main>
      <aside className="hidden min-w-0 pb-10 pt-12 xl:block">
        {!loading && Content && <TableOfContents articleRef={articleRef} />}
      </aside>
    </div>
  );
}

function Breadcrumbs({ title }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 text-base">
      <ol className="flex items-center gap-2">
        <li>
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
        </li>
        <li aria-current="page" className="flex items-center gap-2">
          <ChevronRightIcon className="size-3 text-foreground/50" />
          {title}
        </li>
      </ol>
    </nav>
  );
}

function MDXContent({ loading, Content }: MdxContentProps) {
  if (loading) {
    return (
      <section className="flex items-center justify-center py-12">
        <span
          className="size-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary"
          role="status"
          aria-label="Loading documentation"
        />
      </section>
    );
  }

  if (!Content) return null;

  return <Content components={mdxComponents as unknown as Record<string, React.ComponentType>} />;
}
