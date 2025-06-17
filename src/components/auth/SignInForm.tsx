"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInAction } from "@/app/actions";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { AuthCard } from "./AuthCard";
import { ThirdPartyAuth } from "./ThirdPartyAuth";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SignInFormProps {
  showThirdParty?: boolean;
  showImage?: boolean;
}

interface SignInResponse {
  error?: string;
  success?: boolean;
}

export function SignInForm({ showThirdParty = true, showImage = true }: SignInFormProps) {
  const t = useTranslations("Auth");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    try {
      setIsLoading(true);
      setError(null);
      const result = await signInAction(formData);

      if (typeof result === "object" && result !== null) {
        const data = result as SignInResponse;
        if (data.error) {
          // Map Supabase error messages to translation keys
          const errorKey = data.error.toLowerCase().includes("invalid login credentials")
            ? "errors.invalidCredentials"
            : data.error.toLowerCase().includes("email not confirmed")
              ? "errors.emailNotConfirmed"
              : "errors.generic";
          setError(t(errorKey));
        }
      }
    } catch (err) {
      console.error("Sign in error:", err);
      setError(t("errors.unexpected"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthCard showImage={showImage} variant="signin">
      <form action={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-2xl font-bold">{t("signIn.title")}</h1>
          <p className="text-balance text-muted-foreground">{t("signIn.description")}</p>
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
            disabled={isLoading}
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("password")}</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              {t("forgotPassword.title")}
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
            required
            disabled={isLoading}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? t("signIn.action") + "..." : t("signIn.action")}
        </Button>

        {showThirdParty && <ThirdPartyAuth />}

        <div className="text-center text-sm">
          {t("signIn.noAccount")}{" "}
          <Link href="/sign-up" className="text-primary hover:underline">
            {t("signIn.signUpLink")}
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
