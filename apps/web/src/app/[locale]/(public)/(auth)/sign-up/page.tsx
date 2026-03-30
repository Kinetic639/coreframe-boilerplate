import { SignUpForm } from "@/components/auth/forms/sign-up-form";
import { FormMessage, Message } from "@/components/form-message";
import { SmtpMessage } from "../smtp-message";
import { AuthCard } from "@/components/auth/AuthCard";
import { generatePageMetadata } from "@/lib/metadata";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Message & { invitation?: string }>;
};

export async function generateMetadata({ params }: Props) {
  return generatePageMetadata(params, "metadata.auth.signUp");
}

export default async function Signup(props: Props) {
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
        <SignUpForm message={searchParams} invitationToken={searchParams.invitation} />
      </AuthCard>
      <SmtpMessage />
    </>
  );
}
