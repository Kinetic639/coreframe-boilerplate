import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

export const metadata: Metadata = {
  title: "Admin Panel | CoreFrame",
  description: "System administration and testing tools",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  // TODO: Implement proper super_admin role verification
  // For now, allowing all authenticated users to access admin panel
  // Uncomment below when super_admin role is properly set up:
  // const userMetadata = user.user_metadata;
  // const isSuperAdmin = userMetadata?.role === "super_admin";
  // if (!isSuperAdmin) {
  //   notFound();
  // }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
