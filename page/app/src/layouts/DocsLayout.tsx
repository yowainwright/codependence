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
    <div className="flex min-h-screen flex-col">
      <SiteHeader onOpenSidebar={() => setSidebarOpen(true)} />
      <div className="flex flex-1 items-stretch">
        <aside className="hidden w-80 shrink-0 border-r border-foreground/10 bg-background lg:block">
          <div className="sticky top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <SideBar />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1">{children}</div>
        </div>
      </div>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-80 max-w-none rounded-none p-0"
        >
          <SheetTitle className="sr-only">Documentation navigation</SheetTitle>
          <SideBar onNavigate={closeSidebar} />
        </SheetContent>
      </Sheet>
      <Footer />
    </div>
  );
}
