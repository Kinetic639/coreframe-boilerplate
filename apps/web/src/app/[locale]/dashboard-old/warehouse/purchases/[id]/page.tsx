import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PurchaseOrderDetails } from "@/modules/warehouse/purchases/components/purchase-order-details";

export const metadata = {
  title: "Purchase Order Details | Warehouse",
  description: "View purchase order details",
};

interface PageProps {
  params: {
    id: string;
    locale: string;
  };
}

export default async function PurchaseOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard-old/warehouse/purchases">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Order Details</h1>
          <p className="text-muted-foreground">View and manage purchase order</p>
        </div>
      </div>

      {/* Details */}
      <PurchaseOrderDetails purchaseOrderId={id} />
    </div>
  );
}
