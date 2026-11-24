import { useState } from "react";
import { SideBar } from "@/components/docs/SideBar";
import { Footer } from "@/components/common/Footer";
import { SiteHeader } from "@/components/header";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { DocsLayoutProps } from "@/types";

export function DocsLayout({ children }: DocsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-dvh flex-col font-sans text-foreground">
      <SiteHeader onOpenSidebar={() => setSidebarOpen(true)} />
      <div className="flex flex-1 items-stretch">
        <aside className="hidden w-64 shrink-0 border-r border-foreground/10 lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto py-4">
            <SideBar />
          </div>
        </aside>
        {children}
      </div>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="max-w-[90vw] overflow-y-auto rounded-none px-0 py-4 data-[side=left]:w-80"
        >
          <SheetTitle className="border-b border-foreground/10 px-4 pb-3">Codependence</SheetTitle>
          <SideBar onNavigate={closeSidebar} />
        </SheetContent>
      </Sheet>
      <Footer />
    </div>
  );
}
