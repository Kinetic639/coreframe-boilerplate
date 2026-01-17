import { getTranslations, getLocale } from "next-intl/server";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

/**
 * Catch-all route at locale level
 *
 * Required for next-intl to properly render not-found with locale context.
 * Renders the 404 UI directly instead of calling notFound().
 */
export default async function LocaleCatchAll() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "NotFoundPage.Public" });

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>

        <CardContent>
          <p className="text-center text-sm text-muted-foreground">{t("content")}</p>
        </CardContent>

        <CardFooter className="flex justify-center">
          <Button asChild variant="default">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              {t("backToHomepage")}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
