/**
 * Utility functions for generating URL-safe slugs
 */

/**
 * Generate a URL-safe slug from a string
 * @param text - The text to convert to a slug
 * @param maxLength - Maximum length of the slug (default: 100)
 * @returns A URL-safe slug
 */
export function generateSlug(text: string, maxLength: number = 100): string {
  return (
    text
      .toLowerCase()
      .trim()
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, "-")
      // Remove non-alphanumeric characters except hyphens
      .replace(/[^a-z0-9-]/g, "")
      // Remove multiple consecutive hyphens
      .replace(/--+/g, "-")
      // Remove leading and trailing hyphens
      .replace(/^-+|-+$/g, "")
      // Truncate to max length
      .substring(0, maxLength)
      // Remove trailing hyphen if truncation created one
      .replace(/-+$/, "")
  );
}

/**
 * Generate a unique slug by checking for duplicates and appending a number if needed
 * @param baseSlug - The base slug to make unique
 * @param checkExists - Function that returns true if the slug already exists
 * @param maxAttempts - Maximum number of attempts to find a unique slug (default: 100)
 * @returns A unique slug
 */
export async function generateUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>,
  maxAttempts: number = 100
): Promise<string> {
  let slug = baseSlug;
  let attempt = 1;

  while (attempt <= maxAttempts) {
    const exists = await checkExists(slug);
    if (!exists) {
      return slug;
    }

    // Try with a number suffix
    slug = `${baseSlug}-${attempt}`;
    attempt++;
  }

  // If we couldn't find a unique slug after maxAttempts, add a timestamp
  return `${baseSlug}-${Date.now()}`;
}

/**
 * Generate a template slug from a name and organization ID
 * @param name - The template name
 * @param organizationId - The organization ID (optional, for system templates)
 * @returns A template-specific slug
 */
export function generateTemplateSlug(name: string, organizationId?: string): string {
  const baseSlug = generateSlug(name);

  // For system templates, use the base slug as-is
  if (!organizationId) {
    return baseSlug;
  }

  // For organization templates, we'll rely on the unique constraint in the database
  // and handle conflicts in the service layer
  return baseSlug;
}
