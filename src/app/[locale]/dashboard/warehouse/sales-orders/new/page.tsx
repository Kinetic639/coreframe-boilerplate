export default function NewSalesOrderPage() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Sales Order</h1>
        <p className="text-muted-foreground mt-1">Create a new sales order for a customer</p>
      </div>

      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        <p>Order creation form will be implemented here.</p>
        <p className="text-sm mt-2">
          This will include customer selection, product line items, pricing, and delivery details.
        </p>
      </div>
    </div>
  );
}
