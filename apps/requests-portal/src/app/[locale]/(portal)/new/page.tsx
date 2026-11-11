import { X } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NewRequestForm } from "@/components/requests/new-request-form";
import { Link } from "@/i18n/navigation";
import { requirePortalContext } from "@/server/portal-context";
import {
  listBranchWarehouses,
  listTicketTypes,
  type PortalTicketType,
} from "@/server/requests/requests.service";
import { createClient } from "@/utils/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "requests.new" });
  return { title: t("heading") };
}

export default async function NewRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [ctx, t, supabase] = await Promise.all([
    requirePortalContext(),
    getTranslations("requests.new"),
    createClient(),
  ]);

  const branches = ctx.branches.filter((b) => ctx.can.create(b.id));
  const typesByBranch: Record<string, PortalTicketType[]> = {};
  await Promise.all(
    branches.map(async (b) => {
      const res = await listTicketTypes(supabase, ctx, b.id);
      typesByBranch[b.id] = res.ok ? res.data : [];
    })
  );
  const warehousesByBranch = await listBranchWarehouses(
    supabase,
    ctx,
    branches.map((b) => b.id)
  );
  const defaultBranchId =
    (ctx.activeBranchId &&
      branches.some((b) => b.id === ctx.activeBranchId) &&
      ctx.activeBranchId) ||
    branches[0]?.id;

  return (
    <main className="flex flex-1 justify-center bg-white lg:bg-stone-100 lg:py-8">
      <div className="flex w-full max-w-xl flex-col lg:rounded-2xl lg:bg-white lg:shadow-sm lg:ring-1 lg:ring-stone-200">
        <div className="flex items-center gap-1 border-b border-stone-100 px-2 py-2">
          <Link
            href="/"
            aria-label={t("cancel")}
            className="flex h-11 w-11 items-center justify-center rounded-[10px] text-stone-700"
          >
            <X className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 text-base font-semibold">{t("heading")}</h1>
        </div>
        <div className="px-4 py-4 lg:px-6 lg:py-5">
          {defaultBranchId ? (
            <NewRequestForm
              branches={branches}
              typesByBranch={typesByBranch}
              warehousesByBranch={warehousesByBranch}
              defaultBranchId={defaultBranchId}
            />
          ) : (
            <p className="py-10 text-center text-sm text-stone-500">{t("noCreate")}</p>
          )}
        </div>
      </div>
    </main>
  );
}
