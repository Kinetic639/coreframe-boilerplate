import { SignUpForm } from "@/components/auth/sign-up-form";
import { FormMessage, Message } from "@/components/form-message";
import { SmtpMessage } from "../smtp-message";

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
      <SignUpForm message={searchParams} />
      <SmtpMessage />
    </>
  );
}
