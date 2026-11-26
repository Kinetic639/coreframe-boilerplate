import { getTranslations } from "next-intl/server";
import { appUrl } from "@repo/app-urls";
import { BrandLockup } from "@repo/ui/branding";
import { signOutAction } from "@/app/[locale]/actions";

/** Shown when the user's plan and permissions open no Ambra app at all. */
export async function NoAppAccess({ email }: { email: string }) {
  const t = await getTranslations("ambraApps.chooser");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-5">
      <div className="flex w-full max-w-md flex-col gap-5 rounded-[14px] border border-border bg-card p-8 shadow-sm">
        <BrandLockup size="md" hoverAnimation />
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-xl font-bold text-foreground">{t("noAccessTitle")}</h1>
          <p className="m-0 text-sm leading-relaxed text-muted-foreground">{t("noAccessBody")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
          <span>{email} ·</span>
          <form action={signOutAction} className="inline">
            <button
              type="submit"
              className="cursor-pointer font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
            >
              {t("signOut")}
            </button>
          </form>
          <span>·</span>
          <a
            href={appUrl("site")}
            className="font-medium text-amber-800 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
          >
            {t("website")}
          </a>
        </div>
      </div>
    </main>
  );
}
