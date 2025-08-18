"use client";

import { signUpAction } from "@/app/[locale]/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTranslations } from "next-intl";

const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

type SignUpFormData = z.infer<typeof signUpSchema>;

interface SignUpFormProps {
  message?: Message;
}

export function SignUpForm({ message }: SignUpFormProps) {
  const t = useTranslations("authForms.SignUpForm");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: SignUpFormData) => {
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    formData.append("firstName", data.firstName || "");
    formData.append("lastName", data.lastName || "");
    await signUpAction(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto flex min-w-64 max-w-64 flex-col">
      <h1 className="text-2xl font-medium">{t("title")}</h1>
      <p className="text-sm text-foreground">
        {t("haveAccount")}{" "}
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

        <div className="flex flex-col gap-1">
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <Input
            id="password"
            type="password"
            placeholder={t("passwordPlaceholder")}
            {...register("password")}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="firstName">{t("firstNameLabel")}</Label>
          <Input
            id="firstName"
            type="text"
            placeholder={t("firstNamePlaceholder")}
            {...register("firstName")}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="lastName">{t("lastNameLabel")}</Label>
          <Input
            id="lastName"
            type="text"
            placeholder={t("lastNamePlaceholder")}
            {...register("lastName")}
          />
          {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
        </div>

        <SubmitButton disabled={isSubmitting} pendingText={t("pending")}>
          {t("submit")}
        </SubmitButton>
        {message && <FormMessage message={message} />}
      </div>
    </form>
  );
}
