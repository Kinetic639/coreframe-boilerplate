import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

interface PortalVendorDetailPageProps {
  params: Promise<{
    vendorId: string;
  }>;
}

export default async function PortalVendorDetailPage({ params }: PortalVendorDetailPageProps) {
  await requireDemoSession();

  const { vendorId } = await params;
  const vendors = await VmiPortalRepository.listVendors();
  if (!vendors.success) throw new Error(vendors.error);

  const vendor = vendors.data.find((item) => item.id === vendorId);
  if (!vendor) throw new Error("Vendor not found");

  return (
    <VmiAppShell activeHref="/portal/vendors">
      <section className="space-y-5 text-xs">
        <Link
          href="/portal/vendors"
          className="inline-flex items-center gap-1.5 font-bold text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Wroc do dostawcow
        </Link>

        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
            Panel partnera
          </p>
          <h1 className="mt-2 font-display text-2xl font-black text-foreground">{vendor.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{vendor.portfolio.about}</p>
        </div>
      </section>
    </VmiAppShell>
  );
}
