"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useBusinessContextStore } from "@/lib/stores/business-context-store";
import { Warehouse, ShoppingCart, Building2, CreditCard, Factory } from "lucide-react";

const CONTEXT_ICONS = {
  warehouse: Warehouse,
  ecommerce: ShoppingCart,
  b2b: Building2,
  pos: CreditCard,
  manufacturing: Factory,
};

interface BusinessContextSwitcherProps {
  variant?: "tabs" | "select" | "badges";
  className?: string;
  onContextChange?: (context: string) => void;
}

export function BusinessContextSwitcher({
  variant = "tabs",
  className,
  onContextChange,
}: BusinessContextSwitcherProps) {
  const { currentContext, availableContexts, contextSettings, setCurrentContext } =
    useBusinessContextStore();

  const handleContextChange = (context: string) => {
    setCurrentContext(context as any);
    onContextChange?.(context);
  };

  // Filter to only show enabled contexts
  const enabledContexts = availableContexts.filter((context) => contextSettings[context].enabled);

  if (enabledContexts.length <= 1) {
    return null; // Don't show switcher if only one context available
  }

  if (variant === "select") {
    return (
      <Select value={currentContext} onValueChange={handleContextChange}>
        <SelectTrigger className={cn("w-[200px]", className)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {enabledContexts.map((context) => {
            const config = contextSettings[context];
            const IconComponent = CONTEXT_ICONS[context];

            return (
              <SelectItem key={context} value={context}>
                <div className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4" />
                  <span>{config.name}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  }

  if (variant === "badges") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {enabledContexts.map((context) => {
          const config = contextSettings[context];
          const IconComponent = CONTEXT_ICONS[context];
          const isActive = context === currentContext;

          return (
            <Button
              key={context}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => handleContextChange(context)}
              className={cn("flex items-center gap-2", isActive && "shadow-sm")}
              style={
                isActive
                  ? {
                      backgroundColor: config.color,
                      borderColor: config.color,
                    }
                  : undefined
              }
            >
              <IconComponent className="h-3 w-3" />
              <span className="text-xs font-medium">{config.name}</span>
            </Button>
          );
        })}
      </div>
    );
  }

  // Default: tabs variant
  return (
    <Tabs value={currentContext} onValueChange={handleContextChange} className={className}>
      <TabsList className="grid-cols-auto grid w-full">
        {enabledContexts.map((context) => {
          const config = contextSettings[context];
          const IconComponent = CONTEXT_ICONS[context];

          return (
            <TabsTrigger
              key={context}
              value={context}
              className="flex items-center gap-2"
              data-context={context}
            >
              <IconComponent className="h-4 w-4" />
              <span className="hidden sm:inline">{config.name}</span>
              <Badge
                variant="secondary"
                className="ml-1 h-4 w-4 p-0 text-xs"
                style={{ backgroundColor: config.color + "20", color: config.color }}
              >
                {context.charAt(0).toUpperCase()}
              </Badge>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

interface BusinessContextIndicatorProps {
  context?: string;
  showIcon?: boolean;
  showName?: boolean;
  className?: string;
}

export function BusinessContextIndicator({
  context,
  showIcon = true,
  showName = true,
  className,
}: BusinessContextIndicatorProps) {
  const { currentContext, contextSettings } = useBusinessContextStore();

  const activeContext = context || currentContext;
  const config = contextSettings[activeContext];
  const IconComponent = CONTEXT_ICONS[activeContext];

  if (!config) return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcon && (
        <div
          className="flex h-6 w-6 items-center justify-center rounded"
          style={{ backgroundColor: config.color + "20" }}
        >
          <IconComponent className="h-3 w-3" style={{ color: config.color }} />
        </div>
      )}
      {showName && (
        <span className="text-sm font-medium" style={{ color: config.color }}>
          {config.name}
        </span>
      )}
    </div>
  );
}
