import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { fetchUsers } from "@/utils/admin";
import { checkAdminRole } from "@/utils/adminAuth";

export const metadata = {
  title: "Admin Dashboard",
  description: "Manage users and application settings",
};

export default async function AdminDashboardPage() {
  // Check if the current user has admin role
  await checkAdminRole();

  // Fetch all users with their roles
  const users = await fetchUsers();

  // Calculate stats
  const adminCount = users.filter((user) => user.role === "admin").length;
  const specialistCount = users.filter((user) => user.role === "specialist").length;

  return (
    <div className="container py-6">
      <AdminDashboard users={users} adminCount={adminCount} specialistCount={specialistCount} />
    </div>
  );
}
