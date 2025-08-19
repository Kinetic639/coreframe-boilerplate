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
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, CheckCircle } from "lucide-react";
import { fetchInvitationByToken, type InvitationWithDetails } from "@/lib/api/invitations";

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
  invitationToken?: string;
}

export function SignUpForm({ message, invitationToken }: SignUpFormProps) {
  const t = useTranslations("authForms.SignUpForm");
  const [invitation, setInvitation] = useState<InvitationWithDetails | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(!!invitationToken);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  // Load invitation details if token is provided
  useEffect(() => {
    if (invitationToken) {
      const loadInvitation = async () => {
        try {
          setInvitationLoading(true);
          const invitationData = await fetchInvitationByToken(invitationToken);
          if (invitationData && invitationData.status === "pending") {
            setInvitation(invitationData);
            setValue("email", invitationData.email);
          }
        } catch (error) {
          console.error("Failed to load invitation:", error);
        } finally {
          setInvitationLoading(false);
        }
      };
      loadInvitation();
    }
  }, [invitationToken, setValue]);

  const onSubmit = async (data: SignUpFormData) => {
    const formData = new FormData();
    formData.append("email", data.email);
    formData.append("password", data.password);
    formData.append("firstName", data.firstName || "");
    formData.append("lastName", data.lastName || "");
    if (invitationToken) {
      formData.append("invitationToken", invitationToken);
    }
    await signUpAction(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto flex min-w-64 max-w-64 flex-col">
      <h1 className="text-2xl font-medium">{invitation ? "Dołącz do organizacji" : t("title")}</h1>
      <p className="text-sm text-foreground">
        {invitation ? (
          "Utwórz konto aby zaakceptować zaproszenie"
        ) : (
          <>
            {t("haveAccount")}{" "}
            <Link className="font-medium text-primary underline" href="/sign-in">
              {t("signIn")}
            </Link>
          </>
        )}
      </p>

      {/* Invitation Details */}
      {invitation && (
        <Alert className="mt-4">
          <Mail className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Zaproszenie do: {invitation.organization?.name}</div>
              <div className="text-sm text-muted-foreground">
                Rola: {invitation.role?.display_name || invitation.role?.name}
              </div>
              <div className="text-sm text-muted-foreground">
                Oddział: {invitation.branch?.name}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {invitationLoading && (
        <Alert className="mt-4">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Ładowanie szczegółów zaproszenia...</AlertDescription>
        </Alert>
      )}
      <div className="mt-8 flex flex-col gap-2 [&>input]:mb-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            {...register("email")}
            disabled={!!invitation}
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
