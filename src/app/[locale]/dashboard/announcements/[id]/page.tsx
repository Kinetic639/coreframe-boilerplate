import React from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Calendar, User, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import HasAnyRoleServer from "@/components/auth/HasAnyRoleServer";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { createClient } from "@/utils/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { enUS, pl } from "date-fns/locale";
import { getLocale } from "next-intl/server";
import { cn } from "@/lib/utils";

// Types (same as NewsCard)
interface AnnouncementPost {
  id: string;
  title: string;
  content: any;
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

interface MessageDetailsPageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

async function getAnnouncementPost(id: string): Promise<AnnouncementPost | null> {
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from("announcements")
    .select(
      `
      *,
      author:profiles(
        first_name,
        last_name,
        avatar_url
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !post) {
    return null;
  }

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    excerpt: post.excerpt,
    priority: post.priority,
    badges: post.badges || [],
    author_id: post.author_id,
    author_name:
      post.author?.first_name && post.author?.last_name
        ? `${post.author.first_name} ${post.author.last_name}`
        : undefined,
    author_avatar: post.author?.avatar_url,
    published_at: post.published_at,
    created_at: post.created_at,
    updated_at: post.updated_at,
  };
}

export default async function AnnouncementDetailsPage({ params }: MessageDetailsPageProps) {
  const { id } = await params;
  const t = await getTranslations("announcements");
  const locale = await getLocale();
  const dateLocale = locale === "pl" ? pl : enUS;
  const appContext = await loadAppContextServer();

  const post = await getAnnouncementPost(id);

  if (!post) {
    notFound();
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: dateLocale,
    });
  };

  const renderContent = () => {
    if (typeof post.content === "string") {
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {post.content.split("\n").map((paragraph, index) => (
            <p key={index} className="mb-4 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      );
    }

    // For Lexical content, this would need a proper renderer
    return (
      <div className="rounded-md border p-4 text-center text-muted-foreground">
        Rich content renderer not implemented yet. Content available in editor format.
      </div>
    );
  };

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard/announcements">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("widget.viewAll")}
            </Button>
          </Link>

          {appContext?.activeOrgId && (
            <HasAnyRoleServer
              checks={[{ role: "org_owner", scope: "org", id: appContext.activeOrgId }]}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Edit className="mr-2 h-4 w-4" />
                    {t("form.edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("form.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </HasAnyRoleServer>
          )}
        </div>

        {/* Message Card */}
        <Card className={cn("border-l-4", priorityBorderColors[post.priority])}>
          <CardHeader>
            <div className="space-y-4">
              {/* Title */}
              <h1 className="text-2xl font-bold leading-tight text-foreground">{post.title}</h1>

              {/* Author and date */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    {post.author_avatar && (
                      <AvatarImage src={post.author_avatar} alt={post.author_name} />
                    )}
                    <AvatarFallback className="text-xs">
                      {post.author_name ? (
                        post.author_name.charAt(0).toUpperCase()
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <span>
                    {t("widget.publishedBy", {
                      author: post.author_name || "Unknown",
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <time dateTime={post.published_at}>
                    {t("widget.timeAgo", {
                      time: formatDate(post.published_at),
                    })}
                  </time>
                </div>
              </div>

              {/* Badges and Priority */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={cn("text-xs", priorityColors[post.priority])}>
                  {t(`priority.${post.priority}`)}
                </Badge>

                {post.badges.map((badge) => (
                  <Badge key={badge} variant="outline" className="text-xs">
                    {SYSTEM_BADGES.has(badge) ? t(`badges.${badge}` as any) : badge}
                  </Badge>
                ))}
              </div>

              {/* Short Description */}
              {post.excerpt && (
                <div className="rounded-md bg-muted/50 p-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Full Content */}
            <div className="text-sm">{renderContent()}</div>

            {/* Footer with timestamps */}
            <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
              <span>Created {formatDate(post.created_at)}</span>
              {post.updated_at !== post.created_at && (
                <span>Updated {formatDate(post.updated_at)}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
