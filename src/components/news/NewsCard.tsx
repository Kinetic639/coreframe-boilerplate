"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { useLocale } from "next-intl";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MoreVertical, Edit, Trash2, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface NewsPost {
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
  news: NewsPost;
  onEdit?: (news: NewsPost) => void;
  onDelete?: (newsId: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  compact?: boolean;
  className?: string;
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

export function NewsCard({
  news,
  onEdit,
  onDelete,
  canEdit = false,
  canDelete = false,
  compact = false,
  className,
}: NewsCardProps) {
  const t = useTranslations("news");
  const locale = useLocale();
  const dateLocale = locale === "pl" ? pl : enUS;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: dateLocale,
    });
  };

  const renderContent = () => {
    if (compact) {
      return (
        news.excerpt ||
        (typeof news.content === "string"
          ? news.content.slice(0, 150) + "..."
          : "No preview available")
      );
    }

    // For full view, we'd need to render the Lexical content
    // This is a simplified version - you might want to create a dedicated renderer
    if (news.excerpt) {
      return news.excerpt;
    }

    return "Content available in editor format";
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

            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Avatar className="h-5 w-5">
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

              <span className="text-xs">
                {t("widget.publishedBy", {
                  author: news.author_name || "Unknown",
                })}
              </span>

              <span className="text-xs">•</span>

              <time className="text-xs" dateTime={news.published_at}>
                {t("widget.timeAgo", {
                  time: formatDate(news.published_at),
                })}
              </time>
            </div>
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
              {t(`badges.${badge}` as any, { default: badge })}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className={cn("pt-0", compact && "pb-3")}>
        <p className={cn("leading-relaxed text-muted-foreground", compact ? "text-sm" : "text-sm")}>
          {renderContent()}
        </p>
      </CardContent>

      {!compact && (
        <CardFooter className="border-t pt-3">
          <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
            <span>Created {formatDate(news.created_at)}</span>
            {news.updated_at !== news.created_at && (
              <span>Updated {formatDate(news.updated_at)}</span>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
