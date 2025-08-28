"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";

// Validation schema
const newsFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional(),
  priority: z.enum(["normal", "important", "urgent", "critical"]).default("normal"),
  badges: z.array(z.string()).default([]),
});

export type NewsFormData = z.infer<typeof newsFormSchema>;

interface NewsFormProps {
  initialData?: Partial<NewsFormData>;
  onSubmit: (data: NewsFormData) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

const defaultBadgeOptions = [
  "announcement",
  "update",
  "maintenance",
  "feature",
  "bugfix",
  "security",
  "important",
  "urgent",
  "info",
];

export function NewsForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel,
}: NewsFormProps) {
  const t = useTranslations("news");
  const [badgeInput, setBadgeInput] = useState("");

  const form = useForm<NewsFormData>({
    resolver: zodResolver(newsFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      content: initialData?.content || "",
      excerpt: initialData?.excerpt || "",
      priority: initialData?.priority || "normal",
      badges: initialData?.badges || [],
    },
  });

  const badges = form.watch("badges");

  const addBadge = (badgeText: string) => {
    const trimmed = badgeText.trim();
    if (trimmed && !badges.includes(trimmed)) {
      form.setValue("badges", [...badges, trimmed]);
      setBadgeInput("");
    }
  };

  const removeBadge = (badgeToRemove: string) => {
    form.setValue(
      "badges",
      badges.filter((badge) => badge !== badgeToRemove)
    );
  };

  const handleBadgeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addBadge(badgeInput);
    }
  };

  const handleSubmit = async (data: NewsFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error("Error submitting news form:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.title")}</FormLabel>
              <FormControl>
                <Input placeholder={t("form.titlePlaceholder")} {...field} disabled={isLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="excerpt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.excerpt")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("form.excerptPlaceholder")}
                  {...field}
                  disabled={isLoading}
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("form.content")}</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("form.contentPlaceholder")}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("form.priority")}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isLoading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="normal">{t("priority.normal")}</SelectItem>
                    <SelectItem value="important">{t("priority.important")}</SelectItem>
                    <SelectItem value="urgent">{t("priority.urgent")}</SelectItem>
                    <SelectItem value="critical">{t("priority.critical")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <FormLabel>{t("form.badges")}</FormLabel>
            <div className="space-y-3">
              <Input
                placeholder={t("form.badgePlaceholder")}
                value={badgeInput}
                onChange={(e) => setBadgeInput(e.target.value)}
                onKeyDown={handleBadgeInputKeyDown}
                disabled={isLoading}
              />

              {/* Quick badge options */}
              <div className="flex flex-wrap gap-1">
                {defaultBadgeOptions.map(
                  (badge) =>
                    !badges.includes(badge) && (
                      <Button
                        key={badge}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addBadge(badge)}
                        disabled={isLoading}
                        className="h-6 text-xs"
                      >
                        {t(`badges.${badge}` as any)}
                      </Button>
                    )
                )}
              </div>

              {/* Current badges */}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {badges.map((badge) => (
                    <Badge key={badge} variant="secondary" className="flex items-center gap-1">
                      {t(`badges.${badge}` as any, { default: badge })}
                      <button
                        type="button"
                        onClick={() => removeBadge(badge)}
                        disabled={isLoading}
                        className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              {t("form.cancel")}
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? submitLabel === t("form.edit")
                ? t("form.updating")
                : t("form.saving")
              : submitLabel || t("form.save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
