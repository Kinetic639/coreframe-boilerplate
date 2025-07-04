"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export const signOutAction = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const locale = await getLocale();
  return redirect({ href: "/sign-in", locale });
};
