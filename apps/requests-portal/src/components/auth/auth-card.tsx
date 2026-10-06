import { MessageSquareText } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Same two-column card as Ambra's sign-in (apps/web AuthCard), branded for the portal. */
export async function AuthCard({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="grid p-0 md:grid-cols-2">
          <div className="flex flex-col gap-6 p-5 md:p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-stone-900">
                <MessageSquareText className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <span className="text-base font-semibold tracking-tight">{t("name")}</span>
            </div>
            {children}
          </div>
          <div className="relative hidden bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 md:block">
            <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_40%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.1),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(236,72,153,0.1),transparent_40%)]" />
            <p className="absolute inset-x-6 bottom-6 text-sm text-foreground/70">{t("tagline")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
