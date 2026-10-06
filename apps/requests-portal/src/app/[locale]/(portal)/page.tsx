import { getTranslations, setRequestLocale } from "next-intl/server";
import { requirePortalContext } from "@/server/portal-context";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [ctx, t] = await Promise.all([requirePortalContext(), getTranslations("app")]);
  const inScope = ctx.branches.filter((b) => ctx.scopeBranchIds.includes(b.id));

  // Temporary summary until the request list (step 4) replaces this page.
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 p-4">
      <p className="text-sm text-stone-600">{t("signedInAs", { email: ctx.user.email })}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-white p-4 text-sm ring-1 ring-stone-200">
        <dt className="text-stone-500">Org</dt>
        <dd>{ctx.org.name}</dd>
        {inScope.map((b) => (
          <div key={b.id} className="contents">
            <dt className="text-stone-500">{b.name}</dt>
            <dd className="font-mono text-xs">
              {ctx.can.create(b.id) ? "create " : ""}
              {ctx.can.manage(b.id) ? "manage" : ""}
            </dd>
          </div>
        ))}
      </dl>
      <p className="rounded-lg border border-dashed border-stone-300 p-3 text-xs text-stone-500">
        {t("scaffold")}
      </p>
    </main>
  );
}
