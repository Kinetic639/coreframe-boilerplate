"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "react-toastify";
import { DeliveryLineItems } from "./delivery-line-items";
import { createDelivery } from "@/app/actions/warehouse/create-delivery";
import { useAppStore } from "@/lib/stores/app-store";
import type { CreateDeliveryData, DeliveryItem } from "@/modules/warehouse/types/deliveries";
import { StatusStepper, Step } from "@/components/ui/StatusStepper";

interface NewDeliveryFormProps {
  organizationId: string;
  branchId: string;
}

export function NewDeliveryForm({ organizationId, branchId }: NewDeliveryFormProps) {
  const router = useRouter();
  const t = useTranslations("modules.warehouse.items.deliveries");

  const deliverySteps: Step[] = [
    { label: t("status.draft"), value: "draft" },
    { label: t("status.waiting"), value: "waiting" },
    { label: t("status.ready"), value: "ready" },
    { label: t("status.done"), value: "done" },
  ];

  const locations = useAppStore((state) => state.locations);

  const [destinationLocationId, setDestinationLocationId] = useState<string>("none");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 16));
  const [sourceDocument, setSourceDocument] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState(t("shipping.asSoonAsPossible"));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error(t("products.noProducts"));
      return;
    }

    setLoading(true);

    const data: CreateDeliveryData = {
      organization_id: organizationId,
      branch_id: branchId,
      destination_location_id: destinationLocationId !== "none" ? destinationLocationId : undefined,
      scheduled_date: new Date(scheduledDate).toISOString(),
      source_document: sourceDocument,
      delivery_address: deliveryAddress,
      shipping_policy: shippingPolicy,
      notes,
      items,
    };

    const result = await createDelivery(data);

    setLoading(false);

    if (result.success && result.delivery_id) {
      toast.success(t("messages.created"));
      router.push(`/dashboard/warehouse/deliveries/${result.delivery_id}`);
    } else {
      toast.error(result.errors?.[0] || t("messages.error"));
    }
  };

  const handleCancel = () => {
    router.push("/dashboard/warehouse/deliveries");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <button className="text-2xl text-muted-foreground hover:text-yellow-500">☆</button>
            <h1 className="text-3xl font-bold">{t("new")}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            {t("actions.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-[#8B4789] hover:bg-[#7A3E78]"
          >
            {loading ? t("actions.saving") : t("actions.validate")}
          </Button>
        </div>
      </div>

      <div className="w-full">
        <StatusStepper steps={deliverySteps} activeStep="draft" size="md" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>
                  {t("fields.destinationLocation.label")}
                  <span className="text-xs text-muted-foreground ml-2">
                    {t("fields.destinationLocation.optional")}
                  </span>
                </Label>
                <Select
                  value={destinationLocationId}
                  onValueChange={setDestinationLocationId}
                  disabled={locations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        locations.length === 0
                          ? t("fields.destinationLocation.noLocations")
                          : t("fields.destinationLocation.placeholder")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">
                        {t("fields.destinationLocation.none")}
                      </span>
                    </SelectItem>
                    {locations.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        {t("fields.destinationLocation.noLocationsMessage")}
                      </div>
                    ) : (
                      locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name} ({location.code})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {destinationLocationId && destinationLocationId !== "none" && (
                  <p className="text-xs text-muted-foreground">
                    {t("fields.destinationLocation.moveHint")}
                  </p>
                )}
                {(!destinationLocationId || destinationLocationId === "none") && (
                  <p className="text-xs text-yellow-600">
                    {t("fields.destinationLocation.assignHint")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("fields.deliveryAddress.label")}</Label>
                <Input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={t("fields.deliveryAddress.placeholder")}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.scheduledDate")}</Label>
                <Input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.operationType")}</Label>
                <Input value={t("fields.operationType.value")} disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.sourceDocument")}</Label>
                <Input
                  value={sourceDocument}
                  onChange={(e) => setSourceDocument(e.target.value)}
                  placeholder={t("fields.sourceDocument.placeholder")}
                />
              </div>
            </div>
          </Card>

          <Tabs defaultValue="operations" className="w-full">
            <TabsList>
              <TabsTrigger value="operations">{t("tabs.operations")}</TabsTrigger>
              <TabsTrigger value="additional">{t("tabs.additionalInfo")}</TabsTrigger>
              <TabsTrigger value="note">{t("tabs.note")}</TabsTrigger>
            </TabsList>

            <TabsContent value="operations" className="mt-4">
              <Card className="p-6">
                <DeliveryLineItems
                  items={items}
                  onChange={setItems}
                  organizationId={organizationId}
                />
              </Card>
            </TabsContent>

            <TabsContent value="additional" className="mt-4">
              <Card className="p-6">
                <div className="space-y-6">
                  <h3 className="font-semibold">{t("additionalInfo.title")}</h3>

                  <div className="space-y-2">
                    <Label>{t("additionalInfo.shippingPolicy")}</Label>
                    <Input
                      value={shippingPolicy}
                      onChange={(e) => setShippingPolicy(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("additionalInfo.responsible")}</Label>
                    <div className="flex items-center gap-2 p-2 border rounded">
                      <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white font-semibold">
                        M
                      </div>
                      <span>Michalek</span>
                    </div>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="note" className="mt-4">
              <Card className="p-6">
                <div className="space-y-2">
                  <Label>{t("fields.notes.label")}</Label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[200px] p-3 border rounded-md"
                    placeholder={t("fields.notes.placeholder")}
                  />
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  {t("activity.sendMessage")}
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  {t("activity.logNote")}
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  {t("activity.activity")}
                </Button>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">{t("activity.today")}</p>
                <div className="mt-2 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white font-semibold text-sm">
                    M
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Michalek <span className="text-muted-foreground text-xs">5:22 AM</span>
                    </p>
                    <p className="text-sm text-muted-foreground">{t("activity.creatingRecord")}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
