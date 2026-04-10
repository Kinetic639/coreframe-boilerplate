import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordAction } from "@/app/[locale]/actions";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { AuthCard } from "./AuthCard";

interface ForgotPasswordFormProps {
  showImage?: boolean;
}

export function ForgotPasswordForm({ showImage = true }: ForgotPasswordFormProps) {
  const t = useTranslations("Auth");

  return (
    <AuthCard showImage={showImage} variant="forgot-password">
      <form action={forgotPasswordAction} className="flex flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold">{t("forgotPassword.pageTitle")}</h1>
          <p className="text-balance text-muted-foreground">{t("forgotPassword.description")}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          {t("forgotPassword.action")}
        </Button>

        <div className="text-center text-sm">
          {t("forgotPassword.rememberPassword")}{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            {t("forgotPassword.signInLink")}
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
