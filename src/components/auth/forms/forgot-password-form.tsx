"use client";

import { forgotPasswordAction } from "@/app/[locale]/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslations } from "next-intl";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  message?: Message;
}

export function ForgotPasswordForm({ message }: ForgotPasswordFormProps) {
  const t = useTranslations("authForms.ForgotPasswordForm");
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    // Clear the current URL search params (removes old message)
    router.replace(window.location.pathname);

    const formData = new FormData();
    formData.append("email", data.email);
    await forgotPasswordAction(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto flex min-w-64 max-w-64 flex-col">
      <h1 className="text-2xl font-medium">{t("title")}</h1>
      <p className="text-sm text-foreground">
        {t("remembered")}{" "}
        <Link className="font-medium text-primary underline" href="/sign-in">
          {t("signIn")}
        </Link>
      </p>
      <div className="mt-8 flex flex-col gap-2 [&>input]:mb-3">
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

        <SubmitButton disabled={isSubmitting} pendingText={t("sending")}>
          {isSubmitting ? (
            <>
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
              {t("sending")}
            </>
          ) : (
            t("submit")
          )}
        </SubmitButton>

        {message && <FormMessage message={message} />}
      </div>
    </form>
  );
}
