import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Database, Shield } from "lucide-react";
import Link from "next/link";

export default function TestingToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Testing Tools</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Tools for testing and debugging your application
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/testing/api">
          <Card className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                API Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Test API endpoints, webhooks, and server actions
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/testing/database">
          <Card className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-green-600" />
                Database Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Execute queries, test RLS policies, and inspect data
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/testing/permissions">
          <Card className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-600" />
                Permissions Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Test role-based access control and permissions
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
