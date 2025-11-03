"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Package } from "lucide-react";
import { DeliveryLineItems } from "./delivery-line-items";
import type { DeliveryWithRelations } from "@/modules/warehouse/types/deliveries";
import { StatusStepper, Step } from "@/components/ui/StatusStepper";

interface DeliveryDetailsFormProps {
  delivery: DeliveryWithRelations;
  organizationId: string;
  branchId: string;
}

export function DeliveryDetailsForm({
  delivery,
  organizationId,
  branchId: _branchId,
}: DeliveryDetailsFormProps) {
  const router = useRouter();
  const t = useTranslations("modules.warehouse.items.deliveries");

  const deliverySteps: Step[] = [
    { label: t("statuses.pending"), value: "pending" },
    { label: t("statuses.approved"), value: "approved" },
    { label: t("statuses.completed"), value: "completed" },
  ];

  const handleBack = () => {
    router.push("/dashboard/warehouse/deliveries");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <button className="text-2xl text-muted-foreground hover:text-yellow-500">☆</button>
            <div>
              <h1 className="text-3xl font-bold">{delivery.delivery_number}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {delivery.source_document && `Source: ${delivery.source_document}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBack}>
            {t("actions.back")}
          </Button>
          {((delivery.status as string) === "pending" ||
            (delivery.status as string) === "approved") && (
            <Link href={`/dashboard/warehouse/deliveries/${delivery.id}/receive`}>
              <Button className="bg-green-600 hover:bg-green-700" size="lg">
                <Package className="mr-2 h-5 w-5" />
                {t("actions.receiveDelivery")}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Status Stepper */}
      <div className="w-full">
        <StatusStepper steps={deliverySteps} activeStep={delivery.status as string} size="sm" />
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Form Fields */}
        <div className="col-span-2 space-y-6">
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{t("fields.destinationLocation")}</Label>
                <Input
                  value={delivery.destination_location?.name || "Not specified"}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.invoiceDate")}</Label>
                <Input
                  value={
                    delivery.scheduled_date
                      ? new Date(delivery.scheduled_date).toLocaleString()
                      : "Not specified"
                  }
                  disabled
                  className="bg-muted"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.invoiceNumber")}</Label>
                <Input
                  value={delivery.source_document || "Not specified"}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="operations" className="w-full">
            <TabsList>
              <TabsTrigger value="operations">{t("tabs.operations")}</TabsTrigger>
              <TabsTrigger value="additional">{t("tabs.additionalInfo")}</TabsTrigger>
              <TabsTrigger value="note">{t("tabs.note")}</TabsTrigger>
            </TabsList>

            <TabsContent value="operations" className="mt-4">
              <Card className="p-6">
                <DeliveryLineItems
                  items={delivery.items_with_details || delivery.items || []}
                  onChange={() => {}}
                  organizationId={organizationId}
                  readOnly={true}
                />
              </Card>
            </TabsContent>

            <TabsContent value="additional" className="mt-4">
              <Card className="p-6">
                <div className="space-y-6">
                  <h3 className="font-semibold">{t("additionalInfo.title")}</h3>

                  <div className="space-y-2">
                    <Label>{t("additionalInfo.responsible")}</Label>
                    <div className="flex items-center gap-2 p-2 border rounded bg-muted">
                      <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white font-semibold">
                        {delivery.responsible_user?.name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <span>
                        {delivery.responsible_user?.name ||
                          delivery.responsible_user?.email ||
                          "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="note" className="mt-4">
              <Card className="p-6">
                <div className="space-y-2">
                  <Label>{t("fields.notes")}</Label>
                  <textarea
                    value={delivery.notes || ""}
                    readOnly
                    className="w-full min-h-[200px] p-3 border rounded-md bg-muted"
                    placeholder="No notes"
                  />
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Activity */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  Send message
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Log note
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Activity
                </Button>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  {delivery.created_at
                    ? new Date(delivery.created_at).toLocaleDateString()
                    : "Today"}
                </p>
                <div className="mt-2 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white font-semibold text-sm">
                    {delivery.created_by_user?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {delivery.created_by_user?.name || delivery.created_by_user?.email || "User"}{" "}
                      <span className="text-muted-foreground text-xs">
                        {delivery.created_at
                          ? new Date(delivery.created_at).toLocaleTimeString()
                          : ""}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Created delivery {delivery.delivery_number}
                    </p>
                  </div>
                </div>

                {delivery.received_at && (
                  <div className="mt-4 flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white font-semibold text-sm">
                      ✓
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        Delivery completed{" "}
                        <span className="text-muted-foreground text-xs">
                          {new Date(delivery.received_at).toLocaleTimeString()}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(delivery.received_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
