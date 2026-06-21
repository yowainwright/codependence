import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <section className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pt-[68px]">{children}</main>
      <Footer />
    </section>
  );
}
