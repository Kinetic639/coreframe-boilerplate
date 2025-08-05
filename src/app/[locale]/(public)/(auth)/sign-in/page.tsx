import { SignInForm } from "@/components/auth/forms/sign-in-form";
import { Message } from "@/components/form-message";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Message>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.auth.signIn" });
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

export default async function Login(props: Props) {
  const searchParams = await props.searchParams;
  return <SignInForm message={searchParams} />;
}
