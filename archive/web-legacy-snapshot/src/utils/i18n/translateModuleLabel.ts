/**
 * Utility function to translate module labels using the translation key
 */
export function translateModuleLabel(key: string, translations: (key: string) => string): string {
  // Remove "modules." prefix if present, since the translation function is already scoped to modules
  const translationKey = key.startsWith("modules.") ? key.replace("modules.", "") : key;

  try {
    return translations(translationKey);
  } catch {
    // Fallback to the key itself if translation fails
    return key;
  }
}
