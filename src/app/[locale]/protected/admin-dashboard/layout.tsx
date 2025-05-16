import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { PanelLeft } from "lucide-react";
import AppSidebar from "@/components/admin/AppSidebar";

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border bg-background px-4">
            <SidebarTrigger>
              <PanelLeft className="h-5 w-5" />
            </SidebarTrigger>
            <span className="ml-4 text-lg font-semibold">Admin Dashboard</span>
          </header>
          <main className="flex-1 overflow-auto bg-muted/20">
            <div className="container py-6">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
