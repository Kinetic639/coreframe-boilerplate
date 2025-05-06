import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Message } from "@/components/form-message";
import { SmtpMessage } from "../smtp-message";

export default async function ForgotPassword(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return (
    <>
      <ForgotPasswordForm message={searchParams} />
      <SmtpMessage />
    </>
  );
}
