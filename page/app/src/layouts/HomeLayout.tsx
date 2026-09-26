import { Footer } from "@/components/common/Footer";
import { SiteHeader } from "@/components/header";
import type { HomeLayoutProps } from "@/types";

export function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <div>
      <SiteHeader onOpenSidebar={undefined} />
      {children}
      <Footer />
    </div>
  );
}
