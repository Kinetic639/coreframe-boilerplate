"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X, User } from "lucide-react";
import { cn } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/primitives/avatar/user-avatar";

export interface MemberOption {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url?: string | null;
}

interface MemberSelectorProps {
  members: MemberOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxSelections?: number;
  className?: string;
}

export function MemberSelector({
  members,
  selectedIds,
  onChange,
  placeholder = "Select members…",
  disabled = false,
  maxSelections,
  className,
}: MemberSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedMembers = members.filter((m) => selectedIds.includes(m.user_id));

  const toggle = (userId: string) => {
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      if (maxSelections && selectedIds.length >= maxSelections) return;
      onChange([...selectedIds, userId]);
    }
  };

  const remove = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((id) => id !== userId));
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="text-muted-foreground text-sm">
              {selectedIds.length === 0
                ? placeholder
                : `${selectedIds.length} member${selectedIds.length > 1 ? "s" : ""} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search members…" />
            <CommandList>
              <CommandEmpty>
                <div className="flex flex-col items-center gap-1 py-4">
                  <User className="text-muted-foreground h-5 w-5" />
                  <span className="text-muted-foreground text-sm">No members found</span>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {members.map((member) => {
                  const isSelected = selectedIds.includes(member.user_id);
                  const displayLabel = member.name || member.email || member.user_id;
                  return (
                    <CommandItem
                      key={member.user_id}
                      value={`${member.name ?? ""} ${member.email ?? ""}`}
                      onSelect={() => toggle(member.user_id)}
                    >
                      <UserAvatar
                        className="mr-2 h-6 w-6"
                        fullName={member.name}
                        email={member.email}
                        src={member.avatar_url}
                        disabledPopover
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{displayLabel}</span>
                        {member.name && member.email && (
                          <span className="text-muted-foreground truncate text-xs">
                            {member.email}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4 shrink-0",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedMembers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedMembers.map((member) => (
            <Badge
              key={member.user_id}
              variant="secondary"
              className="flex items-center gap-1 pr-1 pl-2 text-xs"
            >
              <UserAvatar
                className="h-4 w-4"
                fullName={member.name}
                email={member.email}
                src={member.avatar_url}
                disabledPopover
              />
              <span className="max-w-[120px] truncate">
                {member.name || member.email || member.user_id}
              </span>
              <button
                type="button"
                onClick={(e) => remove(member.user_id, e)}
                className="hover:bg-muted ml-1 rounded-full p-0.5"
                aria-label={`Remove ${member.name || member.email}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
