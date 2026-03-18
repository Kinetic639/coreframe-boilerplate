"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewsCard, NewsPost } from "./NewsCard";
import { ExternalLink, Plus, Newspaper } from "lucide-react";
import { getNewsPosts } from "@/app/actions/news-actions";
import { AddNewsDialog } from "./AddNewsDialog";
import HasAnyRoleClient from "@/components/auth/HasAnyRoleClient";
import { useAppStore } from "@/lib/stores/app-store";

interface RecentNewsWidgetProps {
  limit?: number;
  showActions?: boolean;
  compact?: boolean;
}

export function RecentNewsWidget({
  limit = 5,
  showActions = true,
  compact = false,
}: RecentNewsWidgetProps) {
  const t = useTranslations("news");
  const { activeOrgId, isLoaded: appLoaded } = useAppStore();
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRecentNews = useCallback(async () => {
    if (!activeOrgId) {
      console.error("No active organization available");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await getNewsPosts(limit);

      if (error) {
        console.error("Error loading recent news:", error);
      } else if (data) {
        setNews(data);
      }
    } catch (error) {
      console.error("Error loading recent news:", error);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, limit]);

  useEffect(() => {
    if (appLoaded && activeOrgId) {
      loadRecentNews();
    } else if (appLoaded && !activeOrgId) {
      setLoading(false);
    }
  }, [appLoaded, activeOrgId, loadRecentNews]);

  const handleNewsAdded = () => {
    loadRecentNews();
  };

  if (!appLoaded || loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Newspaper className="h-4 w-4" />
            {t("widget.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-md bg-muted"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activeOrgId) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Newspaper className="h-4 w-4" />
            {t("widget.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-6 text-center">
            <div className="text-sm text-muted-foreground">No organization selected</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Newspaper className="h-4 w-4" />
          {t("widget.title")}
        </CardTitle>
        {showActions && (
          <div className="flex items-center gap-2">
            <HasAnyRoleClient allowedUsers={[{ role: "org_owner", scope: "org" }]}>
              <AddNewsDialog onSuccess={handleNewsAdded}>
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </AddNewsDialog>
            </HasAnyRoleClient>
            <Link href="/dashboard-old/news">
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {news.length === 0 ? (
          <div className="py-6 text-center">
            <div className="mb-3 text-sm text-muted-foreground">{t("noNewsDescription")}</div>
            <HasAnyRoleClient allowedUsers={[{ role: "org_owner", scope: "org" }]}>
              <AddNewsDialog onSuccess={handleNewsAdded}>
                <Button variant="outline" size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("addNews")}
                </Button>
              </AddNewsDialog>
            </HasAnyRoleClient>
          </div>
        ) : (
          <div className="space-y-3">
            {news.map((post) => (
              <NewsCard
                key={post.id}
                news={post}
                compact={compact}
                showViewDetails={true}
                className="border-0 border-l-2 shadow-none"
              />
            ))}

            {news.length >= limit && (
              <div className="border-t pt-3">
                <Link href="/dashboard-old/news">
                  <Button variant="ghost" className="w-full text-sm">
                    {t("widget.viewAll")}
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
