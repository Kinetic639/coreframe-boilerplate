"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeliveryLineItems } from "./delivery-line-items";
import type { DeliveryWithRelations } from "@/modules/warehouse/types/deliveries";
import { StatusStepper, Step } from "@/components/ui/StatusStepper";
import {
  getDeliveryReceipts,
  type DeliveryReceipt,
} from "@/app/actions/warehouse/get-delivery-receipts";
import { FileText, Download, CheckCircle2, Clock } from "lucide-react";

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
  const [receipts, setReceipts] = useState<DeliveryReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  useEffect(() => {
    async function fetchReceipts() {
      setLoadingReceipts(true);
      const data = await getDeliveryReceipts(delivery.id);
      setReceipts(data);
      setLoadingReceipts(false);
    }
    fetchReceipts();
  }, [delivery.id]);

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
        </div>
      </div>

      {/* Status Stepper */}
      <div className="w-full">
        <StatusStepper size="sm" steps={deliverySteps} activeStep={delivery.status as string} />
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
              <TabsTrigger value="receipts">
                {t("tabs.receipts")} {receipts.length > 0 && `(${receipts.length})`}
              </TabsTrigger>
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

            <TabsContent value="receipts" className="mt-4">
              <Card className="p-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{t("receipts.title")}</h3>
                    {loadingReceipts && (
                      <span className="text-sm text-muted-foreground">{t("receipts.loading")}</span>
                    )}
                  </div>

                  {!loadingReceipts && receipts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>{t("receipts.noReceipts")}</p>
                      <p className="text-sm mt-2">{t("receipts.autoGeneratedInfo")}</p>
                    </div>
                  )}

                  {!loadingReceipts && receipts.length > 0 && (
                    <div className="space-y-4">
                      {receipts.map((receipt) => (
                        <Card key={receipt.id} className="p-4 border-2">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4 flex-1">
                              <div className="p-3 bg-green-100 rounded-lg">
                                <FileText className="h-6 w-6 text-green-600" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-lg">
                                    {receipt.receipt_number}
                                  </h4>
                                  {receipt.status === "completed" ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {t("receipts.statusCompleted")}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      <Clock className="h-3 w-3" />
                                      {t("receipts.statusDraft")}
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">
                                      {t("receipts.receiptDate")}:
                                    </span>
                                    <span className="ml-2 font-medium">
                                      {new Date(receipt.receipt_date).toLocaleDateString()}
                                    </span>
                                  </div>
                                  {receipt.pz_document_number && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        {t("receipts.pzDocument")}:
                                      </span>
                                      <span className="ml-2 font-medium">
                                        {receipt.pz_document_number}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-muted-foreground">
                                      {t("receipts.totalItems")}:
                                    </span>
                                    <span className="ml-2 font-medium">
                                      {receipt.total_movements}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">
                                      {t("receipts.totalValue")}:
                                    </span>
                                    <span className="ml-2 font-medium">
                                      {receipt.total_value.toFixed(2)} PLN
                                    </span>
                                  </div>
                                  {receipt.received_by_user && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        {t("receipts.receivedBy")}:
                                      </span>
                                      <span className="ml-2 font-medium">
                                        {receipt.received_by_user.name}
                                      </span>
                                    </div>
                                  )}
                                  {receipt.completed_at && (
                                    <div>
                                      <span className="text-muted-foreground">
                                        {t("receipts.completedAt")}:
                                      </span>
                                      <span className="ml-2 font-medium">
                                        {new Date(receipt.completed_at).toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {receipt.pz_document_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(receipt.pz_document_url, "_blank")}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {t("receipts.downloadPz")}
                              </Button>
                            )}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
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
