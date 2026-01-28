"use client";

import { cn } from "@/lib/utils";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { Wifi, WifiOff, Database } from "lucide-react";
import { useState } from "react";

interface StatusBarProps {
  position?: "top" | "bottom";
  variant?: "full" | "compact";
  className?: string;
}

export function StatusBar({ position = "bottom", variant = "compact", className }: StatusBarProps) {
  const { activeOrgId, activeBranchId } = useAppStoreV2();
  const { user } = useUserStoreV2();
  const isOnline = useState(true);

  const statusItems = [
    {
      icon: isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3 text-red-600" />,
      label: isOnline ? "Online" : "Offline",
      show: true,
    },
    {
      icon: <Database className="h-3 w-3" />,
      label: `Org: ${activeOrgId?.slice(0, 8) || "N/A"}`,
      show: variant === "full" && !!activeOrgId,
    },
    {
      icon: <Database className="h-3 w-3" />,
      label: `Branch: ${activeBranchId?.slice(0, 8) || "N/A"}`,
      show: variant === "full" && !!activeBranchId,
    },
  ];

  return (
    <div
      className={cn(
        "flex-shrink-0 flex items-center gap-4 px-4 py-2 text-xs text-muted-foreground bg-muted/30 border-t",
        position === "top" && "border-t-0 border-b",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {statusItems
          .filter((item) => item.show)
          .map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
      </div>

      {variant === "full" && user && (
        <div className="ml-auto flex items-center gap-2">
          <span>User: {user.email}</span>
        </div>
      )}
    </div>
  );
}
