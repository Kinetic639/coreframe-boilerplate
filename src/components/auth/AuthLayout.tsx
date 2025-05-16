import { useTranslations } from "next-intl";
import Link from "next/link";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface Props {
  children: ReactNode;
  showReturnLink?: boolean;
}

export default function AuthLayout({ children, showReturnLink = true }: Props) {
  const t = useTranslations("Auth");

  return (
    <div className="flex min-h-screen flex-col bg-muted">
      <div className="flex flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {showReturnLink && (
            <div className="mb-6">
              <Button
                variant="ghost"
                asChild
                className="text-muted-foreground hover:text-foreground"
              >
                <Link href="/" className="inline-flex items-center">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t("backToHome")}
                </Link>
              </Button>
            </div>
          )}
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="px-4 py-8 sm:px-10">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
