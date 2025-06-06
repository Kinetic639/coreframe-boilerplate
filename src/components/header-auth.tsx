import { signOutAction } from "@/app/[locale]/actions";
import { Link } from "@/i18n/navigation";
import { Button } from "./ui/button";
import { getTranslations } from "next-intl/server";
import { Badge } from "./ui/badge";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";

export default async function HeaderAuth() {
  const t = await getTranslations("authForms.AuthButton");
  const context = await loadUserContextServer();

  if (!context) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/sign-in">{t("signIn")}</Link>
        </Button>
        <Button asChild size="sm" variant="default">
          <Link href="/sign-up">{t("signUp")}</Link>
        </Button>
      </div>
    );
  }

  const { user, roles } = context;

  const userRole = roles?.length > 0 && roles[0].roles?.slug ? roles[0].roles.slug : null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-end">
        <span>{t("greeting", { email: user.email ?? "" })}</span>
        {userRole && (
          <Badge variant="outline" className="capitalize">
            {userRole}
          </Badge>
        )}
      </div>
      <form action={signOutAction}>
        <Button type="submit" variant="outline">
          {t("signOut")}
        </Button>
      </form>
    </div>
  );
}
