import { createClient } from "@/utils/supabase/server";
import { jwtDecode } from "jwt-decode";
import { Button } from "@/components/ui/button";
import { InfoIcon, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { CustomJwtPayload } from "@/utils/adminAuth";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const t = await getTranslations("ProtectedPage");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return redirect("/sign-in");
  }

  // Check for admin role in JWT claims
  let isAdmin = false;
  try {
    const jwt = jwtDecode<CustomJwtPayload>(session.access_token);
    isAdmin = jwt.user_role === "admin";
  } catch (error) {
    console.error("Error decoding JWT:", error);
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-6">
      <div className="w-full">
        <div className="flex items-center gap-3 rounded-md bg-accent p-3 px-5 text-sm text-foreground">
          <InfoIcon size="16" strokeWidth={2} />
          {t("title")}
        </div>
      </div>

      {isAdmin && (
        <div className="my-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck size={16} />
            Admin Access
          </div>
          <Button asChild>
            <Link href="/protected/admin-dashboard">Access Admin Dashboard</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
