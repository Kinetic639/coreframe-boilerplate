"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FileText, Settings, Users, Package } from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  href?: string;
  action?: () => void;
  keywords?: string[];
}

interface QuickSwitcherProps {
  actions?: QuickAction[];
  placeholder?: string;
}

const defaultActions: QuickAction[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Go to dashboard home",
    icon: <FileText className="h-4 w-4" />,
    href: "/dashboard/start",
    keywords: ["home", "main"],
  },
  {
    id: "settings",
    label: "Settings",
    description: "Manage your account settings",
    icon: <Settings className="h-4 w-4" />,
    href: "/dashboard/account/preferences",
    keywords: ["preferences", "config", "account"],
  },
  {
    id: "team",
    label: "Team",
    description: "Manage team members",
    icon: <Users className="h-4 w-4" />,
    href: "/dashboard/teams",
    keywords: ["members", "users", "people"],
  },
  {
    id: "products",
    label: "Products",
    description: "Browse products",
    icon: <Package className="h-4 w-4" />,
    href: "/dashboard/warehouse/products",
    keywords: ["items", "inventory", "warehouse"],
  },
];

export function QuickSwitcher({
  actions = defaultActions,
  placeholder = "Type a command or search...",
}: QuickSwitcherProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Handle Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = useCallback(
    (action: QuickAction) => {
      setOpen(false);

      if (action.action) {
        action.action();
      } else if (action.href) {
        router.push(action.href as Parameters<typeof router.push>[0]);
      }
    },
    [router]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          {actions.map((action) => (
            <CommandItem
              key={action.id}
              onSelect={() => handleSelect(action)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2 w-full">
                {action.icon && <div className="flex-shrink-0">{action.icon}</div>}
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium">{action.label}</span>
                  {action.description && (
                    <span className="text-xs text-muted-foreground truncate">
                      {action.description}
                    </span>
                  )}
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
