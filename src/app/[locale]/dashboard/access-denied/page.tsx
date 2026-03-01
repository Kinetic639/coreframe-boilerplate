import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";

interface AccessDeniedPageProps {
  searchParams: Promise<{ reason?: string; module?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.accessDenied");
  return { title: t("title") };
}

export default async function AccessDeniedPage({ searchParams }: AccessDeniedPageProps) {
  const { reason, module: moduleName } = await searchParams;
  const t = await getTranslations("pages.accessDenied");

  const showHint = reason === "module_access" && !!moduleName;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-muted p-4">
            <ShieldOff className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
          {showHint && (
            <p className="text-sm text-muted-foreground mt-1">
              {t("moduleHint", { module: moduleName })}
            </p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">{t("contactAdmin")}</p>

        <Button asChild>
          <Link href="/dashboard/start">{t("goToDashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
