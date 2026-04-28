import { SignUpForm } from "@/components/auth/forms/sign-up-form";
import { FormMessage, Message } from "@/components/form-message";
import { generatePageMetadata } from "@/lib/metadata";
import { SiteSettingsService } from "@/server/services/site-settings.service";
import { createServiceClient } from "@/utils/supabase/service";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Message & { invitation?: string }>;
};

export async function generateMetadata({ params }: Props) {
  return generatePageMetadata(params, "metadata.auth.signUp");
}

export default async function Signup(props: Props) {
  const searchParams = await props.searchParams;
  const locale = await getLocale();

  // Invitation links bypass the registration disabled gate
  if (!searchParams.invitation) {
    const settings = await SiteSettingsService.getSettings(createServiceClient());
    if (!settings.registrationEnabled) {
      redirect({ href: "/registration-disabled", locale });
    }
  }

  if ("message" in searchParams) {
    return (
      <div className="flex w-full flex-1 items-center justify-center gap-2 p-4 sm:max-w-md">
        <FormMessage message={searchParams} />
      </div>
    );
  }

  return <SignUpForm message={searchParams} invitationToken={searchParams.invitation} />;
}
