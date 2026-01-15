import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function AuthCodeError() {
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t("authCodeError.title")}</h1>
          <p className="text-muted-foreground text-base">{t("authCodeError.description")}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg">
            <Link href="/forgot-password">{t("authCodeError.requestNewLink")}</Link>
          </Button>
          <Button variant="outline" asChild size="lg">
            <Link href="/sign-in">{t("authCodeError.backToSignIn")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
