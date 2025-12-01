import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReceiveDeliveryForm } from "@/modules/warehouse/deliveries/components/receive-delivery-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

async function ReceiveDeliveryContent({ deliveryId }: { deliveryId: string }) {
  const supabase = await createClient();
  const t = await getTranslations("modules.warehouse.items.deliveries");

  // Fetch delivery movement
  const { data: delivery, error: deliveryError } = await supabase
    .from("stock_movements")
    .select("*")
    .eq("id", deliveryId)
    .eq("movement_type_code", "101") // GR from PO
    .single();

  if (deliveryError || !delivery) {
    console.error("Error fetching delivery:", deliveryError);
    notFound();
  }

  // Check if delivery can be received
  if (delivery.status === "completed") {
    redirect(`/dashboard/warehouse/deliveries/${deliveryId}`);
  }

  if (delivery.status !== "pending" && delivery.status !== "approved") {
    redirect(`/dashboard/warehouse/deliveries/${deliveryId}`);
  }

  // For now, create a single line item from the delivery
  // In a real implementation, you'd have a delivery_items table
  const { data: product } = await supabase
    .from("products")
    .select("id, name, sku")
    .eq("id", delivery.product_id)
    .single();

  const { data: variant } = delivery.variant_id
    ? await supabase
        .from("product_variants")
        .select("id, name, sku")
        .eq("id", delivery.variant_id)
        .single()
    : { data: null };

  const { data: location } = delivery.destination_location_id
    ? await supabase
        .from("locations")
        .select("id, name")
        .eq("id", delivery.destination_location_id)
        .single()
    : { data: null };

  const deliveryItems = [
    {
      product_id: delivery.product_id,
      product_name: product?.name || "Unknown Product",
      product_sku: product?.sku || "",
      variant_id: delivery.variant_id,
      variant_name: variant?.name || null,
      quantity_ordered: delivery.quantity,
      unit: delivery.unit_of_measure || "pcs",
      unit_cost: delivery.unit_cost,
      destination_location_id: delivery.destination_location_id!,
      location_name: location?.name || "Unknown Location",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/warehouse/deliveries/${deliveryId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">{t("receiving.title")}</h1>
          </div>
          <p className="text-muted-foreground">
            {t("receiving.movementLabel")}: {delivery.movement_number}
          </p>
        </div>
      </div>

      {/* Delivery Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">{t("receiving.infoTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("receiving.reference")}: {delivery.reference_number || "N/A"} •{" "}
                {t("receiving.created")}: {new Date(delivery.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receive Form */}
      <ReceiveDeliveryForm deliveryId={deliveryId} deliveryItems={deliveryItems} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}

export default async function ReceiveDeliveryPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <ReceiveDeliveryContent deliveryId={id} />
    </Suspense>
  );
}
