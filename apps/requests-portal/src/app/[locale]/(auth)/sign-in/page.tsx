import { getTranslations, setRequestLocale } from "next-intl/server";
import { signInAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/auth/auth-card";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; success?: string; returnUrl?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signIn" });
  return { title: t("title") };
}

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error, success, returnUrl } = await searchParams;
  const t = await getTranslations("auth.signIn");

  return (
    <AuthCard>
      <form action={signInAction} className="flex w-full flex-col">
        {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder={t("emailPlaceholder")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder={t("passwordPlaceholder")} />
            <Link className="self-end text-xs text-foreground underline" href="/forgot-password">
              {t("forgotPassword")}
            </Link>
          </div>
          <SubmitButton pendingText={t("pending")}>{t("submit")}</SubmitButton>
          <FormMessage message={{ error, success }} />
        </div>
      </form>
    </AuthCard>
  );
}
