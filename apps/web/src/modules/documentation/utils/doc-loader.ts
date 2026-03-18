import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface DocFrontmatter {
  title: string;
  slug: string;
  lang: string;
  version?: string;
  lastUpdated?: string;
  tags?: string[];
  category?: string;
  difficulty?: "beginner" | "intermediate" | "advanced" | "expert";
  audience?: string[];
  status?: "draft" | "review" | "published" | "archived";
  related?: string[];
  maintainer?: string;
  estimatedReadTime?: number;
  prerequisites?: string[];
  author?: string;
}

export interface DocContent {
  frontmatter: DocFrontmatter;
  content: string;
  slug: string;
  path: string;
}

const DOCS_BASE_PATH = path.join(process.cwd(), "docs");

/**
 * Get all available sections in the /docs directory
 */
export function getDocSections(): string[] {
  try {
    const entries = fs.readdirSync(DOCS_BASE_PATH, { withFileTypes: true });
    return entries
      .filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith(".")
      )
      .map((entry) => entry.name);
  } catch (error) {
    console.error("Error reading doc sections:", error);
    return [];
  }
}

/**
 * Get all topics within a section
 */
export function getTopicsInSection(section: string): string[] {
  const sectionPath = path.join(DOCS_BASE_PATH, section);

  if (!fs.existsSync(sectionPath)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(sectionPath, { withFileTypes: true });
    return entries
      .filter(
        (entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith(".")
      )
      .map((entry) => entry.name);
  } catch (error) {
    console.error(`Error reading topics in section ${section}:`, error);
    return [];
  }
}

/**
 * Load a documentation file
 */
export function loadDoc(section: string, topic: string, lang: string = "en"): DocContent | null {
  const docPath = path.join(DOCS_BASE_PATH, section, topic, `${lang}.md`);
  const mdxPath = path.join(DOCS_BASE_PATH, section, topic, `${lang}.mdx`);

  // Try MDX first, then MD
  let filePath: string | null = null;
  if (fs.existsSync(mdxPath)) {
    filePath = mdxPath;
  } else if (fs.existsSync(docPath)) {
    filePath = docPath;
  }

  if (!filePath) {
    return null;
  }

  try {
    const fileContents = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      frontmatter: data as DocFrontmatter,
      content,
      slug: topic,
      path: `/${section}/${topic}`,
    };
  } catch (error) {
    console.error(`Error loading doc ${section}/${topic}:`, error);
    return null;
  }
}

/**
 * Load doc with fallback logic (try requested lang, fallback to en)
 */
export function loadDocWithFallback(
  section: string,
  topic: string,
  preferredLang: string = "en"
): { doc: DocContent | null; fallbackUsed: boolean; availableLanguages: string[] } {
  const availableLanguages = getAvailableLanguages(section, topic);

  // Try preferred language first
  let doc = loadDoc(section, topic, preferredLang);
  if (doc) {
    return { doc, fallbackUsed: false, availableLanguages };
  }

  // Fallback to English
  if (preferredLang !== "en") {
    doc = loadDoc(section, topic, "en");
    if (doc) {
      return { doc, fallbackUsed: true, availableLanguages };
    }
  }

  // No doc found
  return { doc: null, fallbackUsed: false, availableLanguages };
}

/**
 * Get available languages for a specific doc
 */
export function getAvailableLanguages(section: string, topic: string): string[] {
  const topicPath = path.join(DOCS_BASE_PATH, section, topic);

  if (!fs.existsSync(topicPath)) {
    return [];
  }

  try {
    const files = fs.readdirSync(topicPath);
    return files
      .filter((file) => file.endsWith(".md") || file.endsWith(".mdx"))
      .map((file) => file.replace(/\.(md|mdx)$/, ""));
  } catch (error) {
    console.error(`Error getting available languages for ${section}/${topic}:`, error);
    return [];
  }
}

/**
 * Get navigation structure for a section
 */
export interface NavItem {
  slug: string;
  title: string;
  path: string;
  children?: NavItem[];
}

export function getSectionNavigation(section: string, lang: string = "en"): NavItem[] {
  const topics = getTopicsInSection(section);

  return topics
    .map((topic) => {
      const doc = loadDoc(section, topic, lang);
      if (!doc) return null;

      return {
        slug: topic,
        title: doc.frontmatter.title,
        path: `/${section}/${topic}`,
      };
    })
    .filter(Boolean) as NavItem[];
}

/**
 * Search documentation
 */
export function searchDocs(query: string, lang: string = "en"): DocContent[] {
  const results: DocContent[] = [];
  const sections = getDocSections();

  for (const section of sections) {
    const topics = getTopicsInSection(section);

    for (const topic of topics) {
      const doc = loadDoc(section, topic, lang);
      if (!doc) continue;

      const searchText = `${doc.frontmatter.title} ${doc.content}`.toLowerCase();
      if (searchText.includes(query.toLowerCase())) {
        results.push(doc);
      }
    }
  }

  return results;
}
