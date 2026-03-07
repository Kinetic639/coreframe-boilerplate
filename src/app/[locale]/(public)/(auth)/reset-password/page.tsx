import { ResetPasswordForm } from "@/components/auth/forms/reset-password-form";
import { AuthCard } from "@/components/auth/AuthCard";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; success?: string; mode?: string }>;
}) {
  const supabase = await createClient();
  // getUser() re-validates the JWT with the Supabase Auth server on every
  // request; getSession() only reads the cookie without server verification.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const locale = await getLocale();

  // User must have a recovery session to access this page
  if (!user) {
    redirect({ href: "/forgot-password", locale });
  }

  const params = await searchParams;
  const message = params.error || params.success || params.message;
  const mode = params.mode === "set" ? "set" : "reset";

  return (
    <AuthCard variant="forgot-password">
      <ResetPasswordForm message={message ? { message } : undefined} mode={mode} />
    </AuthCard>
  );
}
