"use client";

import { Avatar as AvatarUI, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square";
  status?: "online" | "offline" | "away" | "busy";
  className?: string;
}

export function Avatar({
  src,
  alt = "Avatar",
  fallback,
  size = "md",
  shape = "circle",
  status,
  className,
}: AvatarProps) {
  const sizeClasses = {
    xs: "h-6 w-6 text-xs",
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-base",
    lg: "h-12 w-12 text-lg",
    xl: "h-16 w-16 text-xl",
  };

  const statusColors = {
    online: "bg-green-500",
    offline: "bg-gray-400",
    away: "bg-yellow-500",
    busy: "bg-red-500",
  };

  const statusSizes = {
    xs: "h-1.5 w-1.5",
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
    xl: "h-4 w-4",
  };

  // Generate initials from fallback text
  const getInitials = (text?: string) => {
    if (!text) return "";
    return text
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative inline-block">
      <AvatarUI className={cn(sizeClasses[size], shape === "square" && "rounded-md", className)}>
        {src && <AvatarImage src={src} alt={alt} />}
        <AvatarFallback
          className={cn("bg-primary/10 text-primary", shape === "square" && "rounded-md")}
        >
          {fallback ? getInitials(fallback) : <User className="h-1/2 w-1/2" />}
        </AvatarFallback>
      </AvatarUI>

      {/* Status indicator */}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-background",
            statusColors[status],
            statusSizes[size]
          )}
        />
      )}
    </div>
  );
}
