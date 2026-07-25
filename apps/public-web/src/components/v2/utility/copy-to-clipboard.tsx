"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import { cn } from "@/lib/utils";

interface CopyToClipboardProps {
  text: string;
  successMessage?: string;
  children?: React.ReactNode;
  variant?: "button" | "icon" | "inline";
  showToast?: boolean;
  className?: string;
}

export function CopyToClipboard({
  text,
  successMessage = "Copied to clipboard",
  children,
  variant = "button",
  showToast = true,
  className,
}: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      if (showToast) {
        toast.success(successMessage);
      }

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  if (variant === "inline") {
    return (
      <button
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors",
          className
        )}
      >
        {children || text}
        {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <Button variant="ghost" size="icon" onClick={handleCopy} className={cn("h-8 w-8", className)}>
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      </Button>
    );
  }

  // Default: button variant
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className={className}>
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4 text-green-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" />
          {children || "Copy"}
        </>
      )}
    </Button>
  );
}
