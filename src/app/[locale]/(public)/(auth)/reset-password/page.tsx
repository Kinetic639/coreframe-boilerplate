import { ResetPasswordForm } from "@/components/auth/forms/reset-password-form";
import { AuthCard } from "@/components/auth/AuthCard";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; success?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const locale = await getLocale();

  // User must have a recovery session to access this page
  if (!session) {
    redirect({ href: "/forgot-password", locale });
  }

  const params = await searchParams;
  const message = params.error || params.success || params.message;

  return (
    <AuthCard variant="forgot-password">
      <ResetPasswordForm message={message ? { message } : undefined} />
    </AuthCard>
  );
}
