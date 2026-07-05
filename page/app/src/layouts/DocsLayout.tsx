import type { ReactNode } from "react";
import { DocsHeader } from "@/components/docs/DocsHeader";
import { SideBar } from "@/components/docs/SideBar";
import { Footer } from "@/components/common/Footer";

interface DocsLayoutProps {
  children: ReactNode;
}

export function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="drawer lg:drawer-open flex-1">
        <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
        <div className="drawer-content flex flex-col">
          <DocsHeader />
          <div className="flex-1">{children}</div>
        </div>
        <SideBar />
      </div>
      <Footer />
    </div>
  );
}
