import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { type Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.authCodeError");
  return { title: t("title") };
}

export default async function AuthCodeErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("auth.authCodeError");
  await searchParams; // consume to avoid Next.js warning

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md space-y-6 text-center">
        <AlertTriangle className="mx-auto h-16 w-16 text-destructive" />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-base text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/forgot-password">{t("requestNewLink")}</Link>
          </Button>
          <Button variant="outline" asChild size="lg">
            <Link href="/sign-in">{t("backToSignIn")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
