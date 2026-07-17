import { Header } from "@/components/home/Header";
import { Footer } from "@/components/common/Footer";
import type { HomeLayoutProps } from "@/types";

export function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <div>
      <Header />
      {children}
      <Footer />
    </div>
  );
}
