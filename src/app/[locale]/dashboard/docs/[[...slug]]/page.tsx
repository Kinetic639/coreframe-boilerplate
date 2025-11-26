import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  loadDocWithFallback,
  getDocSections,
  getSectionNavigation,
  getTopicsInSection,
} from "@/modules/documentation/utils/doc-loader";
import { DocViewer } from "@/modules/documentation/components/doc-viewer";
import { DocSidebar } from "@/modules/documentation/components/doc-sidebar";

interface Props {
  params: {
    locale: string;
    slug?: string[];
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations("documentation");
  const { slug } = params;

  if (!slug || slug.length === 0) {
    return {
      title: t("title"),
      description: t("description"),
    };
  }

  const [section, topic] = slug;
  if (!topic) {
    return {
      title: `${t(`sections.${section}`)} | ${t("title")}`,
    };
  }

  const { doc } = loadDocWithFallback(section, topic, params.locale);

  if (!doc) {
    return {
      title: t("messages.notFound"),
    };
  }

  return {
    title: `${doc.frontmatter.title} | ${t("title")}`,
    description: doc.frontmatter.category || t("description"),
  };
}

export default async function DocumentationPage({ params }: Props) {
  const t = await getTranslations("documentation");
  const { slug, locale } = params;

  // Get all sections for sidebar
  const sections = getDocSections();
  const allSectionData = sections.map((section) => ({
    section,
    title: t(`sections.${section}`),
    topics: getSectionNavigation(section, locale),
  }));

  // Documentation home page - show getting started
  if (!slug || slug.length === 0) {
    // Redirect to getting started or show welcome page
    const { doc } = loadDocWithFallback("user", "getting-started", locale);

    if (!doc) {
      return (
        <div className="flex h-screen bg-background">
          {/* Sidebar */}
          <DocSidebar sections={allSectionData} currentPath="" locale={locale} />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-8 py-12">
              <h1 className="text-5xl font-bold mb-4">{t("title")}</h1>
              <p className="text-xl text-muted-foreground mb-8">{t("description")}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
                {sections.map((section) => (
                  <a
                    key={section}
                    href={`/${locale}/dashboard/docs/${section}`}
                    className="group p-6 rounded-lg border border-border hover:border-sky-500 hover:shadow-lg transition-all bg-card"
                  >
                    <h2 className="text-2xl font-semibold mb-2 group-hover:text-sky-600">
                      {t(`sections.${section}`)}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {t(`sectionDescriptions.${section}`)}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="flex h-screen bg-background">
        <DocSidebar sections={allSectionData} currentPath="/user/getting-started" locale={locale} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-12">
            <DocViewer
              doc={doc}
              fallbackUsed={false}
              availableLanguages={["en", "pl"]}
              currentLang={locale}
              section="user"
              topic="getting-started"
            />
          </div>
        </main>
      </div>
    );
  }

  // Section page - redirect to first topic
  if (slug.length === 1) {
    const [section] = slug;
    const topics = getTopicsInSection(section);

    if (topics.length === 0) {
      notFound();
    }

    // Redirect to first topic
    const firstTopic = topics[0];
    const { doc } = loadDocWithFallback(section, firstTopic, locale);

    if (!doc) {
      notFound();
    }

    return (
      <div className="flex h-screen bg-background">
        <DocSidebar
          sections={allSectionData}
          currentPath={`/${section}/${firstTopic}`}
          locale={locale}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-12">
            <DocViewer
              doc={doc}
              fallbackUsed={false}
              availableLanguages={["en", "pl"]}
              currentLang={locale}
              section={section}
              topic={firstTopic}
            />
          </div>
        </main>
      </div>
    );
  }

  // Document page - show specific document
  const [section, topic] = slug;
  const { doc, fallbackUsed, availableLanguages } = loadDocWithFallback(section, topic, locale);

  if (!doc) {
    notFound();
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Navigation */}
      <DocSidebar sections={allSectionData} currentPath={`/${section}/${topic}`} locale={locale} />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-12">
          <DocViewer
            doc={doc}
            fallbackUsed={fallbackUsed}
            availableLanguages={availableLanguages}
            currentLang={locale}
            section={section}
            topic={topic}
          />
        </div>
      </main>
    </div>
  );
}
