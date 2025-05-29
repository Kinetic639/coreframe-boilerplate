import { signOutAction } from "@/app/[locale]/actions";
import { Link } from "@/i18n/navigation";
import { Button } from "./ui/button";
import { createClient } from "@/utils/supabase/server";
import { getTranslations } from "next-intl/server";
import { Badge } from "./ui/badge";
import { jwtDecode } from "jwt-decode";
import { CustomJwtPayload } from "@/utils/auth/adminAuth";

export default async function AuthButton() {
  const supabase = await createClient();
  const t = await getTranslations("authForms.AuthButton");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;

  // Get the user role from the JWT if available
  let userRole = null;
  if (session?.access_token) {
    try {
      const jwt = jwtDecode<CustomJwtPayload>(session.access_token);
      userRole = jwt.user_role;
    } catch (error) {
      console.error("Error decoding JWT:", error);
    }
  }

  return user ? (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-end">
        <span>{t("greeting", { email: user?.email || "" })}</span>
        {userRole && (
          <Badge variant="outline" className="capitalize">
            {userRole}
          </Badge>
        )}
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant={"outline"}>
          {t("signOut")}
        </Button>
      </form>
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/sign-in">{t("signIn")}</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/sign-up">{t("signUp")}</Link>
      </Button>
    </div>
  );
}
