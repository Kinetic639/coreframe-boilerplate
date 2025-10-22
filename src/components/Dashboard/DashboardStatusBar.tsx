import { CompactBranchSelector } from "./CompactBranchSelector";
import { StatusBarMessage } from "./StatusBarMessage";

export function DashboardStatusBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex h-8 items-center justify-between border-t bg-background px-4 text-xs shadow-lg">
      <div className="flex items-center space-x-2">
        <CompactBranchSelector />
      </div>
      <div className="flex items-center space-x-2">
        <StatusBarMessage message="Status: All systems nominal" />
      </div>
    </div>
  );
}
