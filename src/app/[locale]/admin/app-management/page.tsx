import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, LayoutDashboard, Settings } from "lucide-react";
import Link from "next/link";

export default function AppManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">App Management</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage users, organizations, and system configuration
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/app-management/users">
          <Card className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                View, edit, and manage all system users
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/app-management/organizations">
          <Card className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutDashboard className="h-5 w-5 text-green-600" />
                Organizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage organizations and branches
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/app-management/config">
          <Card className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-600" />
                System Config
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure system settings and features
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
