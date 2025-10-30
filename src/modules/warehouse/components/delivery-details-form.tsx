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
import { useAppStore } from "@/lib/stores/app-store";
import type { DeliveryWithRelations, DeliveryItem } from "@/modules/warehouse/types/deliveries";
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
    { label: t("statuses.draft"), value: "draft" },
    { label: t("statuses.waiting"), value: "waiting" },
    { label: t("statuses.ready"), value: "ready" },
    { label: t("statuses.done"), value: "done" },
  ];

  // Get locations from store
  const locations = useAppStore((state) => state.locations);

  const [destinationLocationId, setDestinationLocationId] = useState<string>(
    delivery.destination_location_id || ""
  );
  const [deliveryAddress, setDeliveryAddress] = useState(delivery.delivery_address || "");
  const [scheduledDate, setScheduledDate] = useState(() => {
    if (delivery.scheduled_date) {
      try {
        const date = new Date(delivery.scheduled_date);
        if (!isNaN(date.getTime())) {
          return date.toISOString().slice(0, 16);
        }
      } catch (e) {
        console.error("Invalid scheduled_date:", delivery.scheduled_date, e);
      }
    }
    return new Date().toISOString().slice(0, 16);
  });
  const [sourceDocument, setSourceDocument] = useState(delivery.source_document || "");
  const [shippingPolicy, setShippingPolicy] = useState(
    delivery.shipping_policy || "As soon as possible"
  );
  const [notes, setNotes] = useState(delivery.notes || "");
  const [items, setItems] = useState<DeliveryItem[]>(
    delivery.items_with_details || delivery.items || []
  );
  const [loading, setLoading] = useState(false);

  const isEditable = delivery.status === "draft" || delivery.status === "waiting";

  const handleSave = async () => {
    if (!isEditable) {
      toast.error("Cannot edit completed or cancelled deliveries");
      return;
    }

    if (items.length === 0) {
      toast.error(t("products.noProducts"));
      return;
    }

    if (!destinationLocationId) {
      toast.error("Please select a destination location");
      return;
    }

    setLoading(true);

    // TODO: Implement update delivery action
    toast.info("Update delivery feature coming soon...");

    setLoading(false);
  };

  const handleCancel = () => {
    router.push("/dashboard/warehouse/deliveries");
  };

  const handleValidate = async () => {
    // TODO: Implement validate delivery action
    toast.info("Validate delivery feature coming soon...");
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
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            {t("actions.cancel")}
          </Button>
          {isEditable && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
              <Button
                onClick={handleValidate}
                disabled={loading}
                className="bg-[#8B4789] hover:bg-[#7A3E78]"
              >
                {t("actions.validate")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Stepper */}
      <div className="w-full">
        <StatusStepper steps={deliverySteps} activeStep={delivery.status} size="sm" />
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Form Fields */}
        <div className="col-span-2 space-y-6">
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{t("fields.destinationLocation")}</Label>
                <Select
                  value={destinationLocationId}
                  onValueChange={setDestinationLocationId}
                  disabled={!isEditable || locations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        locations.length === 0
                          ? "No locations available"
                          : delivery.destination_location?.name || "Select location"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No locations found.
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
              </div>

              <div className="space-y-2">
                <Label>{t("fields.deliveryAddress")}</Label>
                <Input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="e.g. Lumber Inc"
                  disabled={!isEditable}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.scheduledDate")}</Label>
                <Input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  disabled={!isEditable}
                />
              </div>

              <div className="space-y-2">
                <Label>Operation Type</Label>
                <Input value="Delivery Orders" disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.sourceDocument")}</Label>
                <Input
                  value={sourceDocument}
                  onChange={(e) => setSourceDocument(e.target.value)}
                  placeholder="e.g. PO0032"
                  disabled={!isEditable}
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
                  items={items}
                  onChange={setItems}
                  organizationId={organizationId}
                  readOnly={!isEditable}
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
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("additionalInfo.responsible")}</Label>
                    <div className="flex items-center gap-2 p-2 border rounded">
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
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[200px] p-3 border rounded-md"
                    placeholder="Add notes..."
                    disabled={!isEditable}
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
