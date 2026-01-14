import { Suspense } from "react";
import { SalesOrdersList } from "@/modules/warehouse/sales-orders/components/sales-orders-list";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export default function SalesOrdersPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Orders</h1>
          <p className="text-muted-foreground mt-1">Manage customer sales orders and fulfillment</p>
        </div>
        <Link href="/dashboard-old/warehouse/sales-orders/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </Link>
      </div>

      {/* Sales Orders List */}
      <Suspense fallback={<div>Loading...</div>}>
        <SalesOrdersList />
      </Suspense>
    </div>
  );
}
