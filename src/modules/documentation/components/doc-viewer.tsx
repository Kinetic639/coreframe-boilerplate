"use client";

import { DocContent } from "@/modules/documentation/utils/doc-loader";
import { useTranslations } from "next-intl";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "./mdx-components";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, AlertCircle } from "lucide-react";

interface DocViewerProps {
  doc: DocContent;
  fallbackUsed: boolean;
  availableLanguages: string[];
  currentLang: string;
  section: string;
  topic: string;
}

export function DocViewer({ doc, fallbackUsed, currentLang, section }: DocViewerProps) {
  const t = useTranslations("documentation");
  const { frontmatter, content } = doc;

  return (
    <article className="doc-article">
      {/* Language Fallback Banner */}
      {fallbackUsed && (
        <Alert className="mb-8 border-amber-500/50 bg-amber-50 dark:bg-amber-950/50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            {t("language.notAvailable")} {t("language.showingFallback")}
          </AlertDescription>
        </Alert>
      )}

      {/* Document Header */}
      <header className="mb-12 pb-8 border-b border-border">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">{frontmatter.title}</h1>

        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {frontmatter.lastUpdated && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>{new Date(frontmatter.lastUpdated).toLocaleDateString()}</span>
            </div>
          )}

          {frontmatter.estimatedReadTime && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              <span>{frontmatter.estimatedReadTime} min read</span>
            </div>
          )}

          {frontmatter.author && (
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              <span>{frontmatter.author}</span>
            </div>
          )}
        </div>

        {/* Badges */}
        {(frontmatter.difficulty || frontmatter.status || frontmatter.tags) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {frontmatter.difficulty && (
              <Badge
                variant="outline"
                className={cn(
                  "capitalize",
                  frontmatter.difficulty === "beginner" && "border-green-500 text-green-700",
                  frontmatter.difficulty === "intermediate" && "border-blue-500 text-blue-700",
                  frontmatter.difficulty === "advanced" && "border-purple-500 text-purple-700"
                )}
              >
                {frontmatter.difficulty}
              </Badge>
            )}

            {frontmatter.status && frontmatter.status !== "published" && (
              <Badge variant="secondary" className="capitalize">
                {frontmatter.status}
              </Badge>
            )}
          </div>
        )}

        {/* Prerequisites */}
        {frontmatter.prerequisites && frontmatter.prerequisites.length > 0 && (
          <Alert className="mt-6 border-blue-500/50 bg-blue-50 dark:bg-blue-950/50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <strong className="text-blue-900 dark:text-blue-100">
                {t("metadata.prerequisites")}:
              </strong>
              <ul className="mt-2 ml-4 list-disc text-blue-800 dark:text-blue-200">
                {frontmatter.prerequisites.map((prereq) => (
                  <li key={prereq}>{prereq}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </header>

      {/* Document Content */}
      <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-headings:font-semibold prose-h1:text-4xl prose-h2:text-3xl prose-h2:border-b prose-h2:pb-2 prose-h3:text-2xl prose-h4:text-xl prose-p:leading-7 prose-a:text-sky-600 prose-a:no-underline hover:prose-a:underline prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-[''] prose-code:after:content-[''] prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700 prose-img:rounded-lg prose-img:shadow-lg">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdxComponents as any}>
          {content}
        </ReactMarkdown>
      </div>

      {/* Related Documentation */}
      {frontmatter.related && frontmatter.related.length > 0 && (
        <footer className="mt-16 pt-8 border-t border-border">
          <h3 className="text-lg font-semibold mb-4">{t("metadata.relatedDocs")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {frontmatter.related.map((slug) => (
              <a
                key={slug}
                href={`/${currentLang}/dashboard/docs/${section}/${slug}`}
                className="p-4 rounded-lg border border-border hover:border-sky-500 hover:shadow-md transition-all group"
              >
                <span className="text-sm font-medium group-hover:text-sky-600">{slug}</span>
              </a>
            ))}
          </div>
        </footer>
      )}
    </article>
  );
}

// Helper function for className conditionals
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
