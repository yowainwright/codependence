import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/docs/Sidebar";

interface DocsLayoutProps {
  children: ReactNode;
}

export function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <section className="flex min-h-screen flex-col">
      <Header />
      <main className="drawer lg:drawer-open flex-1">
        <input id="docs-drawer" type="checkbox" className="drawer-toggle" />
        <section className="drawer-content flex flex-col pt-[68px]">
          <article className="flex-1">{children}</article>
        </section>
        <Sidebar />
      </main>
      <Footer />
    </section>
  );
}
