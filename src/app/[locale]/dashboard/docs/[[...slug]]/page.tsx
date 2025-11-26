import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  loadDocWithFallback,
  getDocSections,
  getSectionNavigation,
} from "@/modules/documentation/utils/doc-loader";
import { DocViewer } from "@/modules/documentation/components/doc-viewer";
import { DocNavigation } from "@/modules/documentation/components/doc-navigation";

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

  // Documentation home page - show all sections
  if (!slug || slug.length === 0) {
    const sections = getDocSections();

    return (
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{t("title")}</h1>
          <p className="text-muted-foreground text-lg">{t("description")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <a
              key={section}
              href={`/${locale}/dashboard/docs/${section}`}
              className="group p-6 rounded-lg border border-border hover:border-sky-500 hover:shadow-md transition-all"
            >
              <h2 className="text-xl font-semibold mb-2 group-hover:text-sky-600">
                {t(`sections.${section}`)}
              </h2>
              <p className="text-sm text-muted-foreground">
                Browse {t(`sections.${section}`).toLowerCase()}
              </p>
            </a>
          ))}
        </div>
      </div>
    );
  }

  // Section page - show topics in section
  if (slug.length === 1) {
    const [section] = slug;
    const navigation = getSectionNavigation(section, locale);

    if (navigation.length === 0) {
      notFound();
    }

    return (
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <a
            href={`/${locale}/dashboard/docs`}
            className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
          >
            ← {t("navigation.back")}
          </a>
          <h1 className="text-4xl font-bold mb-2">{t(`sections.${section}`)}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {navigation.map((item) => (
            <a
              key={item.slug}
              href={`/${locale}/dashboard/docs${item.path}`}
              className="group p-4 rounded-lg border border-border hover:border-sky-500 hover:shadow-md transition-all"
            >
              <h3 className="text-lg font-semibold group-hover:text-sky-600">{item.title}</h3>
            </a>
          ))}
        </div>
      </div>
    );
  }

  // Document page - show specific document
  const [section, topic] = slug;
  const { doc, fallbackUsed, availableLanguages } = loadDocWithFallback(section, topic, locale);

  if (!doc) {
    notFound();
  }

  const navigation = getSectionNavigation(section, locale);

  return (
    <div className="flex min-h-screen">
      {/* Left Navigation */}
      <aside className="hidden lg:block w-64 border-r border-border sticky top-0 h-screen overflow-y-auto">
        <div className="p-6">
          <a
            href={`/${locale}/dashboard/docs`}
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
          >
            ← {t("navigation.home")}
          </a>
          <h2 className="font-semibold mb-4">{t(`sections.${section}`)}</h2>
          <DocNavigation items={navigation} currentPath={`/${section}/${topic}`} locale={locale} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-8">
        <DocViewer
          doc={doc}
          fallbackUsed={fallbackUsed}
          availableLanguages={availableLanguages}
          currentLang={locale}
          section={section}
          topic={topic}
        />
      </main>

      {/* Right Sidebar - Table of Contents */}
      <aside className="hidden xl:block w-64 border-l border-border sticky top-0 h-screen overflow-y-auto">
        <div className="p-6">
          <h3 className="font-semibold mb-4">{t("navigation.onThisPage")}</h3>
          {/* TOC will be generated from headings */}
        </div>
      </aside>
    </div>
  );
}
