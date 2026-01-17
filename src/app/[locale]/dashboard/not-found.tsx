import { useTranslations } from "next-intl";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
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
 * Dashboard 404 page
 *
 * Rendered within the dashboard layout with sidebar.
 * Fully localized with next-intl.
 */
export default function DashboardNotFound() {
  const t = useTranslations("NotFoundPage.Dashboard");

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
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

        <CardFooter className="flex gap-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/dashboard/start">
              <Home className="mr-2 h-4 w-4" />
              {t("dashboardHome")}
            </Link>
          </Button>
          <Button onClick={() => window.history.back()} variant="default" className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("goBack")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
