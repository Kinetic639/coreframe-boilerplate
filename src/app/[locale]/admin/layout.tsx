import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { AdminSidebarV2 } from "@/components/v2/admin/admin-sidebar";

export const metadata: Metadata = {
  title: "Admin Panel | Ambra",
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
    <div className="flex min-h-screen bg-background">
      <AdminSidebarV2 />
      <div className="flex flex-1 flex-col">
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
