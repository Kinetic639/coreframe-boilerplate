import { ForgotPasswordForm } from "@/components/auth/forms/forgot-password-form";
import { Message } from "@/components/form-message";
import { SmtpMessage } from "../smtp-message";
import { AuthCard } from "@/components/auth/AuthCard";

export default async function ForgotPassword(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <>
      <AuthCard>
        <ForgotPasswordForm message={searchParams} />
      </AuthCard>
      <SmtpMessage />
    </>
  );
}
