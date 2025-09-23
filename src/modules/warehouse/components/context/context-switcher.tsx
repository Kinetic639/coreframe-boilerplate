"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Warehouse,
  ShoppingCart,
  Building2,
  CreditCard,
  Factory,
  Plus,
  Settings,
  MoreHorizontal,
  Eye,
  EyeOff,
  Palette,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { contextService } from "@/modules/warehouse/api/context-service";
import type { Context } from "@/modules/warehouse/api/context-service";
import { useAppStore } from "@/lib/stores/app-store";
import { toast } from "react-toastify";

// Context icon mapping
const CONTEXT_ICONS = {
  warehouse: Warehouse,
  ecommerce: ShoppingCart,
  b2b: Building2,
  pos: CreditCard,
  manufacturing: Factory,
  custom: Settings,
} as const;

// Context store hook for managing the active context
export function useContextStore() {
  const [currentContext, setCurrentContext] = React.useState<string>("warehouse");
  const [availableContexts, setAvailableContexts] = React.useState<Context[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { activeOrgId } = useAppStore();

  const loadContexts = React.useCallback(async () => {
    if (!activeOrgId) return;

    setIsLoading(true);
    setError(null);
    try {
      const contexts = await contextService.getAvailableContexts(activeOrgId);
      setAvailableContexts(contexts);

      // Set default context if current context is not in available contexts
      if (!contexts.some((ctx) => ctx.context_name === currentContext)) {
        const defaultContext =
          contexts.find((ctx) => ctx.context_name === "warehouse") || contexts[0];
        if (defaultContext) {
          setCurrentContext(defaultContext.context_name);
        }
      }
    } catch (err) {
      console.error("Error loading contexts:", err);
      setError(err instanceof Error ? err.message : "Failed to load contexts");
    } finally {
      setIsLoading(false);
    }
  }, [activeOrgId, currentContext]);

  React.useEffect(() => {
    loadContexts();
  }, [loadContexts]);

  return {
    currentContext,
    setCurrentContext,
    availableContexts,
    isLoading,
    error,
    reloadContexts: loadContexts,
  };
}

interface ContextSwitcherProps {
  variant?: "tabs" | "select" | "badges" | "compact";
  className?: string;
  onContextChange?: (context: string) => void;
  showManagement?: boolean;
}

export function ContextSwitcher({
  variant = "tabs",
  className,
  onContextChange,
  showManagement = false,
}: ContextSwitcherProps) {
  const { currentContext, setCurrentContext, availableContexts, isLoading, error, reloadContexts } =
    useContextStore();

  const [showManagementDialog, setShowManagementDialog] = React.useState(false);

  const handleContextChange = (contextName: string) => {
    setCurrentContext(contextName);
    onContextChange?.(contextName);
  };

  const getContextIcon = (contextName: string) => {
    return CONTEXT_ICONS[contextName as keyof typeof CONTEXT_ICONS] || CONTEXT_ICONS.custom;
  };

  const getContextLabel = (context: Context) => {
    if (
      typeof context.display_label === "object" &&
      context.display_label !== null &&
      !Array.isArray(context.display_label)
    ) {
      const labels = context.display_label as Record<string, any>;
      return labels.en || labels.pl || context.context_name;
    }
    return context.context_name;
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading contexts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-destructive", className)}>
        <span className="text-sm">Error loading contexts</span>
        <Button variant="ghost" size="sm" onClick={reloadContexts}>
          Retry
        </Button>
      </div>
    );
  }

  const enabledContexts = availableContexts.filter((ctx) => ctx.is_active);

  if (enabledContexts.length === 0) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-sm text-muted-foreground">No contexts available</span>
      </div>
    );
  }

  if (variant === "select") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Select value={currentContext} onValueChange={handleContextChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {enabledContexts.map((context) => {
              const IconComponent = getContextIcon(context.context_name);
              const label = getContextLabel(context);

              return (
                <SelectItem key={context.id} value={context.context_name}>
                  <div className="flex items-center gap-2">
                    <IconComponent
                      className="h-4 w-4"
                      style={{ color: context.color || "#10b981" }}
                    />
                    <span>{label}</span>
                    {context.context_type === "system" && (
                      <Badge variant="secondary" className="text-xs">
                        System
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {showManagement && (
          <Button variant="ghost" size="sm" onClick={() => setShowManagementDialog(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (variant === "badges") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {enabledContexts.map((context) => {
          const IconComponent = getContextIcon(context.context_name);
          const label = getContextLabel(context);
          const isActive = context.context_name === currentContext;

          return (
            <Button
              key={context.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => handleContextChange(context.context_name)}
              className={cn("flex items-center gap-2", isActive && "shadow-sm")}
              style={
                isActive
                  ? {
                      backgroundColor: context.color || "#10b981",
                      borderColor: context.color || "#10b981",
                    }
                  : undefined
              }
            >
              <IconComponent className="h-3 w-3" />
              <span className="text-xs font-medium">{label}</span>
              {context.context_type === "system" && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  S
                </Badge>
              )}
            </Button>
          );
        })}
        {showManagement && (
          <Button variant="ghost" size="sm" onClick={() => setShowManagementDialog(true)}>
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (variant === "compact") {
    const activeContext = enabledContexts.find((ctx) => ctx.context_name === currentContext);
    const IconComponent = activeContext
      ? getContextIcon(activeContext.context_name)
      : CONTEXT_ICONS.warehouse;
    const label = activeContext ? getContextLabel(activeContext) : "Warehouse";

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <IconComponent
                className="h-4 w-4"
                style={{ color: activeContext?.color || "#10b981" }}
              />
              <span className="hidden sm:inline">{label}</span>
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Switch Context</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {enabledContexts.map((context) => {
              const IconComponent = getContextIcon(context.context_name);
              const label = getContextLabel(context);
              const isActive = context.context_name === currentContext;

              return (
                <DropdownMenuItem
                  key={context.id}
                  onClick={() => handleContextChange(context.context_name)}
                  className={isActive ? "bg-accent" : ""}
                >
                  <IconComponent
                    className="mr-2 h-4 w-4"
                    style={{ color: context.color || "#10b981" }}
                  />
                  <span>{label}</span>
                  {context.context_type === "system" && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      System
                    </Badge>
                  )}
                </DropdownMenuItem>
              );
            })}
            {showManagement && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowManagementDialog(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Contexts
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Default: tabs variant
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Tabs value={currentContext} onValueChange={handleContextChange}>
        <TabsList
          className="grid w-full"
          style={{ gridTemplateColumns: `repeat(${enabledContexts.length || 1}, minmax(0, 1fr))` }}
        >
          {enabledContexts.map((context) => {
            const IconComponent = getContextIcon(context.context_name);
            const label = getContextLabel(context);

            return (
              <TabsTrigger
                key={context.id}
                value={context.context_name}
                className="flex items-center gap-2"
                data-context={context.context_name}
              >
                <IconComponent className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                <Badge
                  variant="secondary"
                  className="ml-1 h-4 w-4 p-0 text-xs"
                  style={{
                    backgroundColor: (context.color || "#10b981") + "20",
                    color: context.color || "#10b981",
                  }}
                >
                  {context.context_name.charAt(0).toUpperCase()}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      {showManagement && (
        <Button variant="ghost" size="sm" onClick={() => setShowManagementDialog(true)}>
          <Settings className="h-4 w-4" />
        </Button>
      )}

      {/* Context Management Dialog */}
      <ContextManagementDialog
        open={showManagementDialog}
        onOpenChange={setShowManagementDialog}
        contexts={availableContexts}
        onContextsChanged={reloadContexts}
      />
    </div>
  );
}

// Context Indicator Component
interface ContextIndicatorProps {
  context?: string;
  showIcon?: boolean;
  showName?: boolean;
  className?: string;
}

export function ContextIndicator({
  context,
  showIcon = true,
  showName = true,
  className,
}: ContextIndicatorProps) {
  const { currentContext, availableContexts } = useContextStore();

  const activeContext = context || currentContext;
  const contextData = availableContexts.find((ctx) => ctx.context_name === activeContext);

  if (!contextData) return null;

  const IconComponent = getContextIcon(contextData.context_name);
  const label = getContextLabel(contextData);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcon && (
        <div
          className="flex h-6 w-6 items-center justify-center rounded"
          style={{ backgroundColor: (contextData.color || "#10b981") + "20" }}
        >
          <IconComponent className="h-3 w-3" style={{ color: contextData.color || "#10b981" }} />
        </div>
      )}
      {showName && (
        <span className="text-sm font-medium" style={{ color: contextData.color || "#10b981" }}>
          {label}
        </span>
      )}
    </div>
  );
}

// Helper function to get context label
function getContextLabel(context: Context): string {
  if (
    typeof context.display_label === "object" &&
    context.display_label !== null &&
    !Array.isArray(context.display_label)
  ) {
    const labels = context.display_label as Record<string, any>;
    return labels.en || labels.pl || context.context_name;
  }
  return context.context_name;
}

// Helper function to get context icon
function getContextIcon(contextName: string) {
  return CONTEXT_ICONS[contextName as keyof typeof CONTEXT_ICONS] || CONTEXT_ICONS.custom;
}

// Context Management Dialog (placeholder for now)
interface ContextManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contexts: Context[];
  onContextsChanged: () => void;
}

function ContextManagementDialog({
  open,
  onOpenChange,
  contexts,
  onContextsChanged: _onContextsChanged,
}: ContextManagementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Manage Contexts</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Available Contexts</CardTitle>
              <CardDescription>
                Manage which contexts are available for your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contexts.map((context) => {
                  const IconComponent = getContextIcon(context.context_name);
                  const label = getContextLabel(context);

                  return (
                    <div
                      key={context.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded"
                          style={{ backgroundColor: (context.color || "#10b981") + "20" }}
                        >
                          <IconComponent
                            className="h-4 w-4"
                            style={{ color: context.color || "#10b981" }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{label}</span>
                            <Badge
                              variant={context.context_type === "system" ? "secondary" : "default"}
                            >
                              {context.context_type}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{context.context_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // TODO: Toggle context visibility
                            toast.info("Context management coming soon!");
                          }}
                        >
                          {context.is_active ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                        {context.context_type === "custom" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // TODO: Edit custom context
                              toast.info("Context editing coming soon!");
                            }}
                          >
                            <Palette className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // TODO: Create custom context
                    toast.info("Custom context creation coming soon!");
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Custom Context
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
