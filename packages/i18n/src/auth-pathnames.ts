/**
 * Shared localized pathname aliases for the auth flow, used by apps/web and
 * apps/public-web (apps/vmi-client has its own separate, unlocalized
 * "/sign-in" and isn't part of this). Single source of truth so the Polish
 * URL for "sign in" (etc.) can't drift between the two apps that both
 * present it.
 */
export const authPathnames = {
  "/sign-in": {
    en: "/sign-in",
    pl: "/logowanie",
  },
  "/sign-up": {
    en: "/sign-up",
    pl: "/rejestracja",
  },
  "/forgot-password": {
    en: "/forgot-password",
    pl: "/zapomnialem-hasla",
  },
  "/reset-password": {
    en: "/reset-password",
    pl: "/zresetuj-haslo",
  },
  "/auth-code-error": {
    en: "/auth-code-error",
    pl: "/blad-uwierzytelniania",
  },
  "/registration-disabled": {
    en: "/registration-disabled",
    pl: "/rejestracja-wylaczona",
  },
} as const;
