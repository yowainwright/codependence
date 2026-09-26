import { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "@tanstack/react-router";
import { getDocBySlug, getDocComponent, getDocContent, type DocComponent } from "@/content";
import { extractHeadings } from "@/lib/mdx/extractHeadings";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { mdxComponents } from "@/components/docs/MDXComponents";
import { Pagination } from "@/components/docs/Pagination";
import type { Heading } from "@/components/docs/TableOfContents/types";
import type { BreadcrumbsProps, MdxContentProps } from "@/types";
import { Separator } from "@/components/ui/separator";

function useDocContent(slug: string) {
  const doc = getDocBySlug(slug);

  const [Content, setContent] = useState<DocComponent | null>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!doc) {
        setLoading(false);
        return;
      }

      const [rawContent, MDXContent] = await Promise.all([
        getDocContent(slug),
        getDocComponent(slug),
      ]);

      if (cancelled) return;

      const isMissing = !rawContent || !MDXContent;
      if (isMissing) {
        setLoading(false);
        return;
      }

      setHeadings(extractHeadings(rawContent));
      setContent(() => MDXContent);
      setLoading(false);
    }

    setLoading(true);
    load().catch(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [slug, doc]);

  return { doc, Content, headings, loading };
}

export function DocsPage() {
  const { slug } = useParams({ from: "/docs/$slug" });
  const { doc, Content, headings, loading } = useDocContent(slug);

  if (!doc) return <Navigate to="/docs/$slug" params={{ slug: "introduction" }} />;

  return (
    <div className="flex p-5 md:p-10 md:pt-10 xl:gap-20 font-sans">
      <article className="flex flex-col max-w-[620px]">
        <Breadcrumbs title={doc.title} />
        <section className="prose dark:prose-invert md:prose-md mb-10 max-w-none">
          <div>
            <h1>{doc.title}</h1>
            <p>{doc.description}</p>
          </div>
          <Separator className="my-5" />
          <MDXContent loading={loading} Content={Content} />
        </section>
        <Separator className="my-6" />
        <Pagination slug={slug} />
      </article>
      <div>
        <TableOfContents headings={headings} />
      </div>
    </div>
  );
}

function Breadcrumbs({ title }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="pt-0 pb-4 text-sm">
      <ol className="flex items-center gap-2">
        <li>
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
        </li>
        <li aria-current="page" className="text-primary">
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
