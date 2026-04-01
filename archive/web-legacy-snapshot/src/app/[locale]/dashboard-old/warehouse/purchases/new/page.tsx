import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreatePurchaseOrderForm } from "@/modules/warehouse/purchases/components/create-purchase-order-form";

export const metadata = {
  title: "New Purchase Order | Warehouse",
  description: "Create a new purchase order",
};

export default function NewPurchaseOrderPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">New Purchase Order</h1>
          <p className="text-muted-foreground">Create a new purchase order from a supplier</p>
        </div>
      </div>

      {/* Form */}
      <CreatePurchaseOrderForm />
    </div>
  );
}
