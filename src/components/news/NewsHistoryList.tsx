"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { NewsCard, NewsPost } from "./NewsCard";
import { EditNewsDialog } from "./EditNewsDialog";
import { DeleteNewsDialog } from "./DeleteNewsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Loader2 } from "lucide-react";
import { getNewsPosts } from "@/app/actions/news-actions";
import { useUserStore } from "@/lib/stores/user-store";
import { useAppStore } from "@/lib/stores/app-store";

export function NewsHistoryList() {
  const t = useTranslations("news");
  const permissions = useUserStore((s) => s.permissions);
  const { activeOrgId, isLoaded: appLoaded } = useAppStore();
  const [news, setNews] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [editingNews, setEditingNews] = useState<NewsPost | null>(null);
  const [deletingNewsId, setDeletingNewsId] = useState<string | null>(null);

  // Check permissions
  const canEdit = permissions?.includes("news.update");
  const canDelete = permissions?.includes("news.delete");

  const loadNews = useCallback(async () => {
    if (!activeOrgId) {
      console.error("No active organization available");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await getNewsPosts();

      if (error) {
        toast.error(t("errors.loadFailed"));
        console.error("Error loading news:", error);
      } else if (data) {
        setNews(data);
      }
    } catch (error) {
      toast.error(t("errors.loadFailed"));
      console.error("Error loading news:", error);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, t]);

  useEffect(() => {
    if (appLoaded && activeOrgId) {
      loadNews();
    } else if (appLoaded && !activeOrgId) {
      // App is loaded but no active org - set loading false and show error state
      setLoading(false);
    }
  }, [appLoaded, activeOrgId, loadNews]);

  // Filter news based on search term and priority
  const filteredNews = news.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.excerpt?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === "all" || post.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  const handleEdit = (newsPost: NewsPost) => {
    setEditingNews(newsPost);
  };

  const handleDelete = (newsId: string) => {
    setDeletingNewsId(newsId);
  };

  const handleEditComplete = () => {
    setEditingNews(null);
    loadNews(); // Reload the news list
  };

  const handleDeleteComplete = () => {
    setDeletingNewsId(null);
    loadNews(); // Reload the news list
  };

  // Show loading while app context is loading
  if (!appLoaded || loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading news...</span>
        </div>
      </div>
    );
  }

  // Show error if no active organization
  if (!activeOrgId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="mb-2 text-muted-foreground">No active organization found</div>
          <div className="text-sm text-muted-foreground">
            Please select an organization to view news
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            placeholder="Search news..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.all")}</SelectItem>
              <SelectItem value="normal">{t("priority.normal")}</SelectItem>
              <SelectItem value="important">{t("priority.important")}</SelectItem>
              <SelectItem value="urgent">{t("priority.urgent")}</SelectItem>
              <SelectItem value="critical">{t("priority.critical")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* News List */}
      {filteredNews.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mb-2 text-muted-foreground">
            {searchTerm || priorityFilter !== "all" ? (
              <span>No news found matching your filters.</span>
            ) : (
              <span>{t("noNewsDescription")}</span>
            )}
          </div>
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setPriorityFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredNews.map((post) => (
            <NewsCard
              key={post.id}
              news={post}
              onEdit={canEdit ? handleEdit : undefined}
              onDelete={canDelete ? handleDelete : undefined}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingNews && (
        <EditNewsDialog
          news={editingNews}
          onClose={() => setEditingNews(null)}
          onComplete={handleEditComplete}
        />
      )}

      {/* Delete Dialog */}
      {deletingNewsId && (
        <DeleteNewsDialog
          newsId={deletingNewsId}
          onClose={() => setDeletingNewsId(null)}
          onComplete={handleDeleteComplete}
        />
      )}
    </div>
  );
}
