"use client";

import { DocContent } from "@/modules/documentation/utils/doc-loader";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "./mdx-components";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, Tag, BookOpen } from "lucide-react";

interface DocViewerProps {
  doc: DocContent;
  fallbackUsed: boolean;
  availableLanguages: string[];
  currentLang: string;
  section: string;
  topic: string;
}

export function DocViewer({
  doc,
  fallbackUsed,
  availableLanguages,
  currentLang,
  section,
  topic,
}: DocViewerProps) {
  const t = useTranslations("documentation");
  const { frontmatter, content } = doc;

  return (
    <article className="prose prose-slate dark:prose-invert max-w-none">
      {/* Language Fallback Banner */}
      {fallbackUsed && (
        <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertDescription>
            {t("language.notTranslated", { language: currentLang })}{" "}
            {t("language.viewOriginal", { language: "English" })}
          </AlertDescription>
        </Alert>
      )}

      {/* Document Header */}
      <header className="mb-8 not-prose">
        <h1 className="text-4xl font-bold mb-4">{frontmatter.title}</h1>

        {/* Metadata Row */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
          {frontmatter.lastUpdated && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>
                {t("metadata.lastUpdated")}:{" "}
                {new Date(frontmatter.lastUpdated).toLocaleDateString()}
              </span>
            </div>
          )}

          {frontmatter.estimatedReadTime && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{t("metadata.minutes", { count: frontmatter.estimatedReadTime })}</span>
            </div>
          )}

          {frontmatter.author && (
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>{frontmatter.author}</span>
            </div>
          )}

          {frontmatter.version && (
            <div className="flex items-center gap-1">
              <span>
                {t("metadata.version")}: {frontmatter.version}
              </span>
            </div>
          )}
        </div>

        {/* Tags and Difficulty */}
        <div className="flex flex-wrap gap-2 mb-4">
          {frontmatter.difficulty && (
            <Badge variant="outline" className="capitalize">
              {t(`difficulty.${frontmatter.difficulty}`)}
            </Badge>
          )}

          {frontmatter.status && frontmatter.status !== "published" && (
            <Badge variant="secondary">{t(`status.${frontmatter.status}`)}</Badge>
          )}

          {frontmatter.tags?.map((tag) => (
            <Badge key={tag} variant="secondary">
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>

        {/* Language Switcher */}
        {availableLanguages.length > 1 && (
          <div className="flex gap-2 mb-4">
            {availableLanguages.map((lang) => (
              <Button
                key={lang}
                variant={lang === currentLang ? "default" : "outline"}
                size="sm"
                asChild
              >
                <a href={`/${lang}/dashboard/docs/${section}/${topic}`}>{lang.toUpperCase()}</a>
              </Button>
            ))}
          </div>
        )}

        {/* Prerequisites */}
        {frontmatter.prerequisites && frontmatter.prerequisites.length > 0 && (
          <Alert className="mb-6">
            <AlertDescription>
              <strong>{t("metadata.prerequisites")}:</strong>
              <ul className="mt-2 ml-4 list-disc">
                {frontmatter.prerequisites.map((prereq) => (
                  <li key={prereq}>{prereq}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </header>

      {/* Document Content - Rendered with ReactMarkdown */}
      <div className="doc-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdxComponents as any}>
          {content}
        </ReactMarkdown>
      </div>

      {/* Related Documentation */}
      {frontmatter.related && frontmatter.related.length > 0 && (
        <footer className="mt-12 not-prose">
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {t("metadata.relatedDocs")}
            </h3>
            <ul className="space-y-2">
              {frontmatter.related.map((slug) => (
                <li key={slug}>
                  <a
                    href={`/${currentLang}/dashboard/docs/${section}/${slug}`}
                    className="text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    {slug}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </footer>
      )}
    </article>
  );
}
