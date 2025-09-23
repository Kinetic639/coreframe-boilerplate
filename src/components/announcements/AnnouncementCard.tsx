"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { useLocale } from "next-intl";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MoreVertical,
  Edit,
  Trash2,
  User,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LexicalContentRenderer } from "./LexicalContentRenderer";

// System badges that should be translated
const SYSTEM_BADGES = new Set([
  "announcement",
  "update",
  "maintenance",
  "feature",
  "bugfix",
  "security",
  "important",
  "urgent",
  "info",
]);

export interface AnnouncementPost {
  id: string;
  title: string;
  content: any; // JSONB content from Lexical editor
  excerpt?: string;
  priority: "normal" | "important" | "urgent" | "critical";
  badges: string[];
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  published_at: string;
  created_at: string;
  updated_at: string;
}

interface NewsCardProps {
  news: AnnouncementPost;
  onEdit?: (news: AnnouncementPost) => void;
  onDelete?: (newsId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  compact?: boolean;
  className?: string;
  showViewDetails?: boolean;
}

const priorityColors = {
  normal: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  important: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  urgent: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const priorityBorderColors = {
  normal: "border-l-gray-300 dark:border-l-gray-700",
  important: "border-l-blue-500 dark:border-l-blue-400",
  urgent: "border-l-orange-500 dark:border-l-orange-400",
  critical: "border-l-red-500 dark:border-l-red-400",
};

export function AnnouncementCard({
  news,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
  compact = false,
  className,
  showViewDetails = true,
}: NewsCardProps) {
  const t = useTranslations("announcements");
  const locale = useLocale();
  const dateLocale = locale === "pl" ? pl : enUS;
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: dateLocale,
    });
  };

  const renderContent = () => {
    if (compact) {
      // For compact mode, just show the excerpt or truncated content
      const shortContent =
        news.excerpt ||
        (typeof news.content === "string"
          ? news.content.slice(0, 150) + "..."
          : "Click to view full message...");
      return <span className="text-sm leading-relaxed text-foreground">{shortContent}</span>;
    }

    // For non-compact mode, show full accordion functionality
    const hasContent =
      news.content && (typeof news.content === "string" ? news.content.length > 0 : true);

    const shortContent =
      news.excerpt ||
      (typeof news.content === "string"
        ? news.content.slice(0, 200) + (news.content.length > 200 ? "..." : "")
        : "Click to expand full message...");

    // Always show accordion for non-compact if we have content
    const showAccordion =
      hasContent &&
      (!news.excerpt ||
        (typeof news.content === "string" && news.content.length > 200) ||
        typeof news.content !== "string");

    return (
      <div className="space-y-3">
        <div className="text-sm leading-relaxed text-foreground">
          {isExpanded ? (
            <LexicalContentRenderer content={news.content} />
          ) : (
            <div className="whitespace-pre-wrap">{shortContent}</div>
          )}
        </div>

        {/* Show expand/collapse button */}
        {showAccordion && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-auto p-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="mr-1 h-3 w-3" />
                {t("form.showLess")}
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3 w-3" />
                {t("form.showMore")}
              </>
            )}
          </Button>
        )}
      </div>
    );
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(news);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(news.id);
    }
  };

  return (
    <Card
      className={cn(
        "border-l-4 transition-shadow hover:shadow-md",
        priorityBorderColors[news.priority],
        className
      )}
    >
      <CardHeader className={cn("pb-3", compact && "pb-2")}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "font-semibold leading-tight text-foreground",
                compact ? "text-sm" : "text-base"
              )}
            >
              {news.title}
            </h3>
          </div>

          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    {t("form.edit")}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("form.delete")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Badge variant="secondary" className={cn("text-xs", priorityColors[news.priority])}>
            {t(`priority.${news.priority}`)}
          </Badge>

          {news.badges.map((badge) => (
            <Badge key={badge} variant="outline" className="text-xs">
              {SYSTEM_BADGES.has(badge) ? t(`badges.${badge}` as any) : badge}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className={cn("pt-0", compact && "pb-3")}>
        {compact ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{renderContent()}</p>
        ) : (
          renderContent()
        )}

        {/* View Details button for compact mode */}
        {compact && showViewDetails && (
          <div className="mt-3 flex justify-end">
            <Link href={`/dashboard/announcements/${news.id}`}>
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                <ExternalLink className="mr-1 h-3 w-3" />
                {t("form.viewDetails")}
              </Button>
            </Link>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t pt-3">
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          {/* Left side - Author */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              {news.author_avatar && (
                <AvatarImage src={news.author_avatar} alt={news.author_name} />
              )}
              <AvatarFallback className="text-xs">
                {news.author_name ? (
                  news.author_name.charAt(0).toUpperCase()
                ) : (
                  <User className="h-3 w-3" />
                )}
              </AvatarFallback>
            </Avatar>
            <span>{news.author_name || "Unknown"}</span>
          </div>

          {/* Right side - Publication date */}
          <time dateTime={news.published_at}>{formatDate(news.published_at)}</time>
        </div>
      </CardFooter>
    </Card>
  );
}
