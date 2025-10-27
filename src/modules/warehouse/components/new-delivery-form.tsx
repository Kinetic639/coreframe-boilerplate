"use client";

import { useState, useEffect, useCallback } from "react";
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
import { DeliveryStatusBadge } from "./delivery-status-badge";
import { createDelivery } from "@/app/actions/warehouse/create-delivery";
import { createClient } from "@/utils/supabase/client";
import type { CreateDeliveryData, DeliveryItem } from "@/modules/warehouse/types/deliveries";

interface Location {
  id: string;
  name: string;
  code: string;
}

interface NewDeliveryFormProps {
  organizationId: string;
  branchId: string;
}

export function NewDeliveryForm({ organizationId, branchId }: NewDeliveryFormProps) {
  const router = useRouter();
  const t = useTranslations("modules.warehouse.items.deliveries");

  const [locations, setLocations] = useState<Location[]>([]);
  const [destinationLocationId, setDestinationLocationId] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split("T")[0]);
  const [sourceDocument, setSourceDocument] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState("As soon as possible");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load locations
  const loadLocations = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("locations")
      .select("id, name, code")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("name");

    if (!error && data && data.length > 0) {
      setLocations(data);
      // Auto-select first location
      if (!destinationLocationId) {
        setDestinationLocationId(data[0].id);
      }
    }
  }, [organizationId, branchId, destinationLocationId]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error(t("products.noProducts"));
      return;
    }

    if (!destinationLocationId) {
      toast.error("Please select a destination location");
      return;
    }

    setLoading(true);

    const data: CreateDeliveryData = {
      organization_id: organizationId,
      branch_id: branchId,
      destination_location_id: destinationLocationId,
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
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <button className="text-2xl text-muted-foreground hover:text-yellow-500">☆</button>
            <h1 className="text-3xl font-bold">New Delivery</h1>
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
            {loading ? "Saving..." : t("actions.validate")}
          </Button>
        </div>
      </div>

      {/* Status Pipeline */}
      <div className="flex gap-2">
        <DeliveryStatusBadge status="draft" />
        <span className="text-muted-foreground">→</span>
        <DeliveryStatusBadge status="waiting" />
        <span className="text-muted-foreground">→</span>
        <DeliveryStatusBadge status="ready" />
        <span className="text-muted-foreground">→</span>
        <DeliveryStatusBadge status="done" />
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Form Fields */}
        <div className="col-span-2 space-y-6">
          <Card className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{t("fields.destinationLocation")}</Label>
                <Select value={destinationLocationId} onValueChange={setDestinationLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("fields.deliveryAddress")}</Label>
                <Input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="e.g. Lumber Inc"
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
                <Label>Operation Type</Label>
                <Input value="Delivery Orders" disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.sourceDocument")}</Label>
                <Input
                  value={sourceDocument}
                  onChange={(e) => setSourceDocument(e.target.value)}
                  placeholder="e.g. PO0032"
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
                  <Label>{t("fields.notes")}</Label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[200px] p-3 border rounded-md"
                    placeholder="Add notes..."
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
                <p className="text-sm text-muted-foreground">Today</p>
                <div className="mt-2 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white font-semibold text-sm">
                    M
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      Michalek <span className="text-muted-foreground text-xs">5:22 AM</span>
                    </p>
                    <p className="text-sm text-muted-foreground">Creating a new record...</p>
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
