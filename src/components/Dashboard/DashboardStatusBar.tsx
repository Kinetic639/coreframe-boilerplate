"use client";

import React from "react";

export function DashboardStatusBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex h-8 items-center justify-between border-t bg-background px-4 text-xs shadow-lg">
      <div className="flex items-center space-x-2">
        {/* Placeholder for compact Branch Selector */}
        <span className="text-muted-foreground">Branch: Main</span>
      </div>
      <div className="flex items-center space-x-2">
        {/* Placeholder for Notification/Toast */}
        <span className="text-muted-foreground">Status: All systems nominal</span>
      </div>
    </div>
  );
}
