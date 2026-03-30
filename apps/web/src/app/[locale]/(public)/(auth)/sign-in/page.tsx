import { SignInForm } from "@/components/auth/forms/sign-in-form";
import { Message } from "@/components/form-message";
import { generatePageMetadata } from "@/lib/metadata";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Message & { returnUrl?: string }>;
};

export async function generateMetadata({ params }: Props) {
  return generatePageMetadata(params, "metadata.auth.signIn");
}

export default async function Login(props: Props) {
  const searchParams = await props.searchParams;
  return <SignInForm message={searchParams} returnUrl={searchParams.returnUrl} />;
}
