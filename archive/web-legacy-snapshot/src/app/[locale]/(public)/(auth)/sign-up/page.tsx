import { SignUpForm } from "@/components/auth/forms/sign-up-form";
import { FormMessage, Message } from "@/components/form-message";
import { SmtpMessage } from "../smtp-message";
import { AuthCard } from "@/components/auth/AuthCard";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Message & { invitation?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.auth.signUp" });
  const common = await getTranslations({ locale, namespace: "metadata.common" });

  return {
    title: `${t("title")}${common("separator")}${common("appName")}`,
    description: t("description"),
    openGraph: {
      title: `${t("title")}${common("separator")}${common("appName")}`,
      description: t("description"),
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${t("title")}${common("separator")}${common("appName")}`,
      description: t("description"),
    },
  };
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
