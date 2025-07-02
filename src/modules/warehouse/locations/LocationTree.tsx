"use client";

import * as Accordion from "@radix-ui/react-accordion";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tables } from "../../../../supabase/types/types";

export interface LocationTreeItem {
  id: string;
  name: string;
  icon_name?: string | null;
  code?: string | null;
  color?: string | null;
  children?: LocationTreeItem[];
  raw: Tables<"locations">;
}

interface TreeProps {
  data: LocationTreeItem[];
  selectedId?: string;
  onSelect?: (item: LocationTreeItem) => void;
  className?: string;
}

export function Tree({ data, selectedId, onSelect, className }: TreeProps) {
  return (
    <Accordion.Root type="multiple" className={cn("space-y-1 text-sm", className)}>
      {data.map((item) => (
        <TreeNode key={item.id} node={item} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </Accordion.Root>
  );
}

function TreeNode({
  node,
  selectedId,
  onSelect,
}: {
  node: LocationTreeItem;
  selectedId?: string;
  onSelect?: (item: LocationTreeItem) => void;
}) {
  const isSelected = node.id === selectedId;
  const hasChildren = node.children && node.children.length > 0;
  const Icon = getLucideIcon(node.icon_name);

  if (hasChildren) {
    return (
      <Accordion.Item value={node.id}>
        <Accordion.Header>
          <Accordion.Trigger
            className={cn(
              "group flex w-full items-center px-2 py-1.5 text-left hover:bg-muted/40",
              isSelected && "bg-accent text-accent-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(node);
            }}
          >
            <ChevronRight className="mr-1 h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
            {Icon && <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">{node.name}</span>
            {node.code && <span className="ml-1 text-xs text-muted-foreground">({node.code})</span>}
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="ml-1 border-l border-border pl-4">
          {node.children?.map((child) => (
            <TreeNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </Accordion.Content>
      </Accordion.Item>
    );
  }

  return (
    <div
      className={cn(
        "flex cursor-pointer items-center px-2 py-1.5 hover:bg-muted/40",
        isSelected && "bg-accent text-accent-foreground"
      )}
      onClick={() => onSelect?.(node)}
    >
      {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground" />}
      <span className="truncate">{node.name}</span>
      {node.code && <span className="ml-1 text-xs text-muted-foreground">({node.code})</span>}
    </div>
  );
}

function getLucideIcon(name?: string | null): LucideIcon | undefined {
  const icon = name && (LucideIcons[name as keyof typeof LucideIcons] as unknown);
  return typeof icon === "function" ? (icon as LucideIcon) : undefined;
}
