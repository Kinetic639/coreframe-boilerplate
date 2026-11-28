"use client";

import { signInAction } from "@/app/[locale]/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { AppTransitionScreen } from "@repo/ui/app-transition";
import { z } from "zod";
import { AuthCard } from "../AuthCard";

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type SignInFormData = z.infer<typeof signInSchema>;

interface SignInFormProps {
  message?: Message;
  returnUrl?: string;
}

export function SignInForm({ message, returnUrl }: SignInFormProps) {
  const t = useTranslations("authForms.SignInForm");
  const [isNavigating, setIsNavigating] = useState(false);

  // Back from the next page via the back/forward cache: the form is usable again.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setIsNavigating(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const {
    register,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  return (
    <AuthCard showImage={true} variant="signin">
      {/*
        Signed in: the session cookie is set and the header already shows the
        user, while the next page (chooser or default app, often on another
        subdomain) loads. Cover the page from now until it unloads, so the
        emptied form is never seen and nobody signs in twice.
      */}
      {isNavigating ? (
        <AppTransitionScreen title={t("redirecting")} hint={t("redirectingHint")} />
      ) : null}
      <form
        action={async (formData) => {
          const { redirectTo } = await signInAction(formData);
          setIsNavigating(true);
          window.location.replace(redirectTo);
        }}
        className="flex w-full flex-col"
      >
        {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}
        <h1 className="text-2xl font-medium">{t("title")}</h1>
        <p className="text-sm text-foreground">
          {t("noAccount")}{" "}
          <Link className="font-medium text-primary underline" href="/sign-up">
            {t("signUp")}
          </Link>
        </p>
        <div className="mt-4 flex flex-col gap-2 [&>input]:mb-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              {...register("email")}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("passwordPlaceholder")}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
            <Link className="text-xs text-foreground underline self-end" href="/forgot-password">
              {t("forgotPassword")}
            </Link>
          </div>

          <div className="mt-4">
            <SubmitButton disabled={isSubmitting || isNavigating} pendingText={t("pending")}>
              {t("submit")}
            </SubmitButton>
          </div>
          {message && <FormMessage message={message} />}
        </div>
      </form>
    </AuthCard>
  );
}
