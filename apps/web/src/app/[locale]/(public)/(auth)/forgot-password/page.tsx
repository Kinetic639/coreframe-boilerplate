import { ForgotPasswordForm } from "@/components/auth/forms/forgot-password-form";
import { Message } from "@/components/form-message";
import { SmtpMessage } from "../smtp-message";
import { AuthCard } from "@/components/auth/AuthCard";
import { generateAuthMetadata } from "@/lib/metadata";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Message>;
};

export async function generateMetadata({ params }: Props) {
  return generateAuthMetadata(params, "metadata.auth.forgotPassword");
}

export default async function ForgotPassword(props: Props) {
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
