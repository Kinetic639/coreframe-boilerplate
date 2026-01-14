import { Suspense } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PurchaseOrdersList } from "@/modules/warehouse/purchases/components/purchase-orders-list";
import { PurchaseOrdersStats } from "@/modules/warehouse/purchases/components/purchase-orders-stats";

export const metadata = {
  title: "Purchase Orders | Warehouse",
  description: "Manage purchase orders and supplier deliveries",
};

export default function PurchaseOrdersPage() {
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">
            Manage purchase orders and track deliveries from suppliers
          </p>
        </div>
        <Link href="/dashboard-old/warehouse/purchases/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Button>
        </Link>
      </div>

      {/* Statistics */}
      <Suspense fallback={<div className="h-24 w-full animate-pulse rounded-lg bg-muted" />}>
        <PurchaseOrdersStats />
      </Suspense>

      {/* Purchase Orders List */}
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-lg bg-muted" />}>
        <PurchaseOrdersList />
      </Suspense>
    </div>
  );
}
