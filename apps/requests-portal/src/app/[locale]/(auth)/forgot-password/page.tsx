import { getTranslations, setRequestLocale } from "next-intl/server";
import { forgotPasswordAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.forgotPassword" });
  return { title: t("title") };
}

export default async function ForgotPasswordPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error, success } = await searchParams;
  const t = await getTranslations("auth.forgotPassword");

  return (
    <AuthCard>
      <form action={forgotPasswordAction} className="flex w-full flex-col">
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("remembered")}{" "}
          <Link className="font-medium text-foreground underline" href="/sign-in">
            {t("signIn")}
          </Link>
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder={t("emailPlaceholder")} />
          </div>
          <SubmitButton pendingText={t("sending")}>{t("submit")}</SubmitButton>
          <FormMessage message={{ error, success }} />
        </div>
      </form>
    </AuthCard>
  );
}
