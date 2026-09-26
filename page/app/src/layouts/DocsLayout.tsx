import { useState } from "react";
import { DocsHeader } from "@/components/docs/DocsHeader";
import { SideBar } from "@/components/docs/SideBar";
import { Footer } from "@/components/common/Footer";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { DocsLayoutProps } from "@/types";

export function DocsLayout({ children }: DocsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1">
        <aside className="hidden w-80 shrink-0 border-r border-foreground/10 bg-background lg:block">
          <SideBar />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <DocsHeader onOpenSidebar={() => setSidebarOpen(true)} />
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
          <SideBar />
        </SheetContent>
      </Sheet>
      <Footer />
    </div>
  );
}
