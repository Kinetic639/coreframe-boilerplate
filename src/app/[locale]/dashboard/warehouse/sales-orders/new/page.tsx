import { SalesOrderForm } from "@/modules/warehouse/sales-orders/components/sales-order-form";

export default function NewSalesOrderPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Sales Order</h1>
        <p className="text-muted-foreground mt-1">Create a new sales order for a customer</p>
      </div>

      <SalesOrderForm />
    </div>
  );
}
