"use client";

import { useState } from "react";
import { DashboardCard } from "./DashboardCard";
import { UsersTable, type User } from "./UsersTable";
import {
  updateUserRoleAction,
  deleteUserAction,
} from "@/app/[locale]/(protected)/dashboard/admin-dashboard/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface AdminDashboardProps {
  users: User[];
  adminCount: number;
  specialistCount: number;
}

export function AdminDashboard({ users, adminCount, specialistCount }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("users");

  // Calculate total user count
  const totalUsers = users.length;

  // Handle role update
  const handleUpdateRole = async (userId: string, role: string) => {
    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("role", role);

    startTransition(async () => {
      const result = await updateUserRoleAction(formData);

      if (result.success) {
        toast.success(result.success);
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  };

  // Handle user deletion
  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      return;
    }

    const formData = new FormData();
    formData.append("userId", userId);

    startTransition(async () => {
      const result = await deleteUserAction(formData);

      if (result.success) {
        toast.success(result.success);
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <DashboardCard title="Total Users" value={totalUsers} icon={<Users size={18} />} />
        <DashboardCard title="Admin Users" value={adminCount} icon={<ShieldCheck size={18} />} />
        <DashboardCard
          title="Specialist Users"
          value={specialistCount}
          icon={<AlertTriangle size={18} />}
        />
      </div>

      <Tabs defaultValue="users" className="w-full" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-1 md:w-auto md:grid-cols-3">
          <TabsTrigger value="users">Users Management</TabsTrigger>
          <TabsTrigger value="roles">Role Permissions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-6">
          <UsersTable
            users={users}
            onUpdateRole={handleUpdateRole}
            onDeleteUser={handleDeleteUser}
          />
        </TabsContent>
        <TabsContent value="roles" className="mt-6">
          <div className="rounded-md border p-4">
            <h3 className="mb-4 text-lg font-medium">Role Permissions</h3>
            <p className="text-sm text-muted-foreground">
              Role permissions are defined in your Supabase database. Below are the current
              permissions:
            </p>
            <div className="mt-4 space-y-2">
              <div className="rounded-md bg-muted p-3">
                <strong>Admin:</strong> Has full access to the admin dashboard and all features.
              </div>
              <div className="rounded-md bg-muted p-3">
                <strong>Specialist:</strong> Has limited access and permissions (users.view only).
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <div className="rounded-md border p-4">
            <h3 className="mb-4 text-lg font-medium">Admin Settings</h3>
            <p className="text-sm text-muted-foreground">
              Admin settings can be configured here. This is currently a placeholder. Add actual
              settings as needed.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
