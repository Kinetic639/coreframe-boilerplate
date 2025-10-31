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
import { useUserStore } from "@/lib/stores/user-store";
import { NewSupplierFormDialog } from "@/modules/warehouse/suppliers/components/new-supplier-form-dialog";
import type { CreateDeliveryData, DeliveryItem } from "@/modules/warehouse/types/deliveries";
import { StatusStepper, Step } from "@/components/ui/StatusStepper";
import { Plus } from "lucide-react";

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

  // Get data from stores
  const locations = useAppStore((state) => state.locations);
  const suppliers = useAppStore((state) => state.suppliers);
  const currentUser = useUserStore((state) => state.user);
  const loadBranchData = useAppStore((state) => state.loadBranchData);

  // Form state
  const [destinationLocationId, setDestinationLocationId] = useState<string>("none");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 16));
  const [sourceDocument, setSourceDocument] = useState("");
  const [shippingPolicy, setShippingPolicy] = useState(t("shipping.asSoonAsPossible"));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Supplier selection
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);

  // Get selected supplier details
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error(t("products.noProducts"));
      return;
    }

    if (!currentUser?.id) {
      toast.error("User not logged in");
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
      responsible_user_id: currentUser.id, // Always use current logged-in user
      notes,
      items,
      supplier_id: selectedSupplierId || undefined,
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

  const handleSupplierCreated = async () => {
    // Reload suppliers after creating new one
    await loadBranchData(branchId);
    // Auto-select the newly created supplier (it will be the most recent one)
    if (suppliers.length > 0) {
      const newestSupplier = suppliers[suppliers.length - 1];
      setSelectedSupplierId(newestSupplier.id);
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
              {/* Supplier/Vendor Selection */}
              <div className="space-y-2">
                <Label>Supplier / Vendor</Label>
                <div className="flex gap-2">
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No suppliers found
                        </div>
                      ) : (
                        suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSupplierDialogOpen(true)}
                    title="Add new supplier"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {selectedSupplier && (
                  <p className="text-xs text-muted-foreground">
                    {selectedSupplier.city && `${selectedSupplier.city}, `}
                    {selectedSupplier.country}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  {t("fields.destinationLocation")}
                  <span className="text-xs text-muted-foreground ml-2">{t("form.optional")}</span>
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
                          ? t("form.noLocationsAvailable")
                          : t("form.selectLocationPlaceholder")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">
                        {t("form.receiveWithoutLocation")}
                      </span>
                    </SelectItem>
                    {locations.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        {t("form.noLocationsFound")}
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
                  <p className="text-xs text-muted-foreground">{t("form.moveToLocationInfo")}</p>
                )}
                {(!destinationLocationId || destinationLocationId === "none") && (
                  <p className="text-xs text-yellow-600">{t("form.receiveWithoutLocationInfo")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("fields.deliveryAddress.label")}</Label>
                <Input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder={t("form.deliveryAddressPlaceholder")}
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
                <Input value={t("form.operationTypeValue")} disabled className="bg-muted" />
              </div>

              <div className="space-y-2">
                <Label>{t("fields.sourceDocument")}</Label>
                <Input
                  value={sourceDocument}
                  onChange={(e) => setSourceDocument(e.target.value)}
                  placeholder={t("form.sourceDocumentPlaceholder")}
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
                    <div className="flex items-center gap-2 p-3 border rounded bg-muted/30">
                      <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white font-semibold">
                        {currentUser && currentUser.first_name && currentUser.last_name
                          ? `${currentUser.first_name[0]}${currentUser.last_name[0]}`.toUpperCase()
                          : currentUser?.email[0].toUpperCase() || "?"}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {currentUser && currentUser.first_name && currentUser.last_name
                            ? `${currentUser.first_name} ${currentUser.last_name}`
                            : currentUser?.email || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Automatically assigned as responsible for this delivery
                        </p>
                      </div>
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
                    placeholder={t("form.notesPlaceholder")}
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
                  {t("form.sendMessage")}
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  {t("form.logNote")}
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  {t("form.activity")}
                </Button>
              </div>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground">{t("form.today")}</p>
                <div className="mt-2 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white font-semibold text-sm">
                    {currentUser && currentUser.first_name && currentUser.last_name
                      ? `${currentUser.first_name[0]}${currentUser.last_name[0]}`.toUpperCase()
                      : currentUser?.email[0].toUpperCase() || "?"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {currentUser && currentUser.first_name && currentUser.last_name
                        ? `${currentUser.first_name} ${currentUser.last_name}`
                        : currentUser?.email || "Unknown"}
                      <span className="text-muted-foreground text-xs ml-1">
                        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">{t("form.activityDescription")}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Supplier Dialog */}
      <NewSupplierFormDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onSuccess={handleSupplierCreated}
      />
    </div>
  );
}
