import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.registrationDisabled" });
  return { title: t("title") };
}

export default function RegistrationDisabledPage() {
  const t = useTranslations("auth.registrationDisabled");

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <ShieldOff className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      <p className="text-xs text-muted-foreground">{t("contactAdmin")}</p>
      <Button asChild variant="outline" className="w-full">
        <Link href="/sign-in">{t("backToSignIn")}</Link>
      </Button>
    </div>
  );
}
