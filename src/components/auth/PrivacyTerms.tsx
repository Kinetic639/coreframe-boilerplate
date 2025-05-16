"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function PrivacyTerms() {
  const t = useTranslations("Auth");

  return (
    <div className="text-balance text-center text-xs text-muted-foreground">
      {t("privacyTerms.prefix")}{" "}
      <Link
        href="/legal/terms"
        className="text-muted-foreground underline underline-offset-4 hover:text-primary"
      >
        {t("privacyTerms.terms")}
      </Link>{" "}
      {t("privacyTerms.separator")}{" "}
      <Link
        href="/legal/privacy"
        className="text-muted-foreground underline underline-offset-4 hover:text-primary"
      >
        {t("privacyTerms.privacy")}
      </Link>
    </div>
  );
}
