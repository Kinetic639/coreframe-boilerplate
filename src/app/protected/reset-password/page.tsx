import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Message } from "@/components/form-message";

export default async function ResetPassword(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  return <ResetPasswordForm message={searchParams} />;
}
