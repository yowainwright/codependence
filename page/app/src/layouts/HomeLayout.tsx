import type { ReactNode } from "react";
import { Header } from "@/components/home/Header";
import { Footer } from "@/components/common/Footer";

interface HomeLayoutProps {
  children: ReactNode;
}

export function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <div>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
