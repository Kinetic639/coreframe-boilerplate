import { SignUpForm } from "@/components/auth/forms/sign-up-form";
import { FormMessage, Message } from "@/components/form-message";
import { SmtpMessage } from "../smtp-message";
import { AuthCard } from "@/components/auth/AuthCard";

export default async function Signup(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  if ("message" in searchParams) {
    return (
      <div className="flex h-screen w-full flex-1 items-center justify-center gap-2 p-4 sm:max-w-md">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  return (
    <>
      <AuthCard>
        <SignUpForm message={searchParams} />
      </AuthCard>
      <SmtpMessage />
    </>
  );
}
