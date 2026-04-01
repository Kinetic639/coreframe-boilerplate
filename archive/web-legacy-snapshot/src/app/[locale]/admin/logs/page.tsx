import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function SystemLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Logs</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View and analyze system logs and events
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Recent Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Log viewing functionality will be implemented here.
            </p>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs dark:border-gray-800 dark:bg-gray-900">
              <div className="space-y-1">
                <div className="text-gray-600 dark:text-gray-400">[INFO] System initialized</div>
                <div className="text-gray-600 dark:text-gray-400">
                  [INFO] Database connection established
                </div>
                <div className="text-gray-600 dark:text-gray-400">[INFO] All services running</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
