import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom theme keys from
// @repo/design-system/public-theme.css. Without this it reads e.g.
// "text-eyebrow" as a text colour and drops it next to "text-ink".
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "h2", "h3", "title", "lead", "body", "small", "eyebrow", "hand"],
      radius: ["button", "card-sm", "card", "card-lg"],
      shadow: ["card", "card-hover", "button"],
      container: ["page", "copy"],
      ease: ["soft", "paint"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
