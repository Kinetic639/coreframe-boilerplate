"use client";

import { useState } from "react";
import { NavItem } from "@/modules/documentation/utils/doc-loader";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, BookOpen, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";

interface SectionData {
  section: string;
  title: string;
  topics: NavItem[];
}

interface DocSidebarProps {
  sections: SectionData[];
  currentPath: string;
  locale: string;
}

export function DocSidebar({ sections, currentPath, locale }: DocSidebarProps) {
  const t = useTranslations("documentation");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    sections.reduce(
      (acc, section) => {
        // Expand section if current path is in it
        const hasActiveTopic = section.topics.some((topic) => currentPath === topic.path);
        acc[section.section] = hasActiveTopic || section.section === "user";
        return acc;
      },
      {} as Record<string, boolean>
    )
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const filteredSections = sections
    .map((section) => ({
      ...section,
      topics: section.topics.filter(
        (topic) =>
          topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          section.title.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((section) => section.topics.length > 0 || !searchQuery);

  return (
    <aside className="w-72 border-r border-border bg-background overflow-y-auto">
      <div className="p-6 border-b border-border">
        <a
          href={`/${locale}/dashboard/docs`}
          className="flex items-center gap-2 text-lg font-semibold hover:text-sky-600 transition-colors"
        >
          <BookOpen className="h-5 w-5" />
          {t("title")}
        </a>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={t("search.placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4">
        <div className="space-y-1">
          {filteredSections.map((sectionData) => {
            const isExpanded = expandedSections[sectionData.section];
            const hasActiveTopic = sectionData.topics.some((topic) => currentPath === topic.path);

            return (
              <div key={sectionData.section} className="space-y-1">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(sectionData.section)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    hasActiveTopic
                      ? "text-sky-600 dark:text-sky-400"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span>{sectionData.title}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {/* Topics */}
                {isExpanded && (
                  <div className="ml-3 space-y-1 border-l border-border pl-3">
                    {sectionData.topics.map((topic) => {
                      const isActive = currentPath === topic.path;

                      return (
                        <a
                          key={topic.slug}
                          href={`/${locale}/dashboard/docs${topic.path}`}
                          className={cn(
                            "block px-3 py-1.5 rounded-md text-sm transition-colors",
                            isActive
                              ? "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          {topic.title}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
