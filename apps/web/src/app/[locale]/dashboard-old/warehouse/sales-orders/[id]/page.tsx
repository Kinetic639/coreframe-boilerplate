import { Suspense } from "react";
import { SalesOrderDetails } from "@/modules/warehouse/sales-orders/components/sales-order-details";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SalesOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-4 p-6">
      <Suspense fallback={<div>Loading order details...</div>}>
        <SalesOrderDetails orderId={id} />
      </Suspense>
    </div>
  );
}
