"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpAction } from "@/app/actions";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { AuthCard } from "./AuthCard";
import { ThirdPartyAuth } from "./ThirdPartyAuth";

interface SignUpFormProps {
  showThirdParty?: boolean;
  showImage?: boolean;
}

export function SignUpForm({ showThirdParty = true, showImage = true }: SignUpFormProps) {
  const t = useTranslations("Auth");

  return (
    <AuthCard showImage={showImage} variant="signup">
      <form action={signUpAction} className="flex flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold">{t("signUp.title")}</h1>
          <p className="text-balance text-muted-foreground">{t("signUp.description")}</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="full_name">{t("fullName")}</Label>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder={t("fullNamePlaceholder")}
            required
          />
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
        <div className="grid gap-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          {t("signUp.action")}
        </Button>

        {showThirdParty && <ThirdPartyAuth />}

        <div className="text-center text-sm">
          {t("signUp.haveAccount")}{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            {t("signUp.signInLink")}
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
