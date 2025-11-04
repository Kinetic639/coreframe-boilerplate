"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { saveDraftDelivery } from "@/app/actions/warehouse/save-draft-delivery";
import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import { NewSupplierFormDialog } from "@/modules/warehouse/suppliers/components/new-supplier-form-dialog";
import type { DeliveryItem } from "@/modules/warehouse/types/deliveries";
import { Plus, Info, ArrowLeft, ArrowRight } from "lucide-react";
import { StatusStepper, Step } from "@/components/ui/StatusStepper";
import { Checkbox } from "@/components/ui/checkbox";

interface NewDeliveryFormProps {
  organizationId: string;
  branchId: string;
}

export function NewDeliveryForm({ organizationId, branchId }: NewDeliveryFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get("draft");
  const t = useTranslations("modules.warehouse.items.deliveries");

  // Get data from stores
  const locations = useAppStore((state) => state.locations);
  const suppliers = useAppStore((state) => state.suppliers);
  const currentUser = useUserStore((state) => state.user);
  const loadBranchData = useAppStore((state) => state.loadBranchData);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [deliveryId, setDeliveryId] = useState<string | undefined>(draftId || undefined);

  // Form state - Step 1
  const [destinationLocationId, setDestinationLocationId] = useState<string>("none");
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 16));
  const [sourceDocument, setSourceDocument] = useState("");
  const [notes, setNotes] = useState("");
  const [requiresVerification, setRequiresVerification] = useState(true);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");

  // Form state - Step 2
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);

  // Get selected supplier details
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  // Load draft data if resuming
  useEffect(() => {
    if (draftId) {
      loadDraftDelivery(draftId);
    }
  }, [draftId]);

  const loadDraftDelivery = async (id: string) => {
    setLoading(true);
    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();

      // Load draft movements
      const { data: movements, error } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("reference_id", id)
        .eq("movement_type_code", "101")
        .eq("status", "draft");

      if (error || !movements || movements.length === 0) {
        toast.error(t("messages.error"));
        router.push("/dashboard/warehouse/deliveries/new");
        return;
      }

      // Get metadata from first movement
      const metadata = movements[0].metadata as any;

      // Restore form data
      if (metadata?.form_data) {
        setDestinationLocationId(metadata.form_data.destination_location_id || "none");
        setScheduledDate(
          metadata.form_data.scheduled_date || new Date().toISOString().slice(0, 16)
        );
        setSourceDocument(metadata.form_data.source_document || "");
        setNotes(metadata.form_data.notes || "");
      }

      if (metadata?.supplier_id) {
        setSelectedSupplierId(metadata.supplier_id);
      }

      if (metadata?.requires_verification !== undefined) {
        setRequiresVerification(metadata.requires_verification);
      }

      // Restore wizard step
      if (metadata?.wizard_step) {
        setCurrentStep(metadata.wizard_step as 1 | 2);
      }

      // Restore items
      const draftItems: DeliveryItem[] = movements.map((m) => ({
        product_id: m.product_id,
        variant_id: m.variant_id || undefined,
        expected_quantity: m.quantity,
        unit_cost: m.unit_cost || undefined,
        batch_number: m.batch_number || undefined,
        serial_number: m.serial_number || undefined,
        expiry_date: m.expiry_date || undefined,
        notes: m.notes || undefined,
      }));

      setItems(draftItems);
      setDeliveryId(id);

      toast.info("Draft loaded");
    } catch (error) {
      console.error("Error loading draft:", error);
      toast.error(t("messages.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!currentUser?.id) {
      toast.error("User not logged in");
      return;
    }

    setLoading(true);

    // Get supplier details for delivery_address
    const supplierAddress = selectedSupplier
      ? `${selectedSupplier.name}${selectedSupplier.address_line_1 ? `, ${selectedSupplier.address_line_1}` : ""}${selectedSupplier.city ? `, ${selectedSupplier.city}` : ""}${selectedSupplier.country ? `, ${selectedSupplier.country}` : ""}`
      : "";

    const result = await saveDraftDelivery({
      delivery_id: deliveryId,
      organization_id: organizationId,
      branch_id: branchId,
      destination_location_id: destinationLocationId !== "none" ? destinationLocationId : undefined,
      scheduled_date: new Date(scheduledDate).toISOString(),
      source_document: sourceDocument,
      delivery_address: supplierAddress,
      responsible_user_id: currentUser.id,
      notes,
      items,
      supplier_id: selectedSupplierId || undefined,
      requires_verification: requiresVerification,
      wizard_step: currentStep,
    });

    setLoading(false);

    if (result.success && result.delivery_id) {
      setDeliveryId(result.delivery_id);
      toast.success("Draft saved");

      // Update URL with draft ID if new draft
      if (!draftId) {
        router.replace(`/dashboard/warehouse/deliveries/new?draft=${result.delivery_id}`);
      }
    } else {
      toast.error(result.errors?.[0] || t("messages.error"));
    }
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validate step 1
      if (requiresVerification && items.length === 0) {
        toast.error(t("products.noProducts"));
        return;
      }

      // Auto-save as draft before moving to next step
      if (!currentUser?.id) {
        toast.error("User not logged in");
        return;
      }

      setLoading(true);

      const supplierAddress = selectedSupplier
        ? `${selectedSupplier.name}${selectedSupplier.address_line_1 ? `, ${selectedSupplier.address_line_1}` : ""}${selectedSupplier.city ? `, ${selectedSupplier.city}` : ""}${selectedSupplier.country ? `, ${selectedSupplier.country}` : ""}`
        : "";

      const result = await saveDraftDelivery({
        delivery_id: deliveryId,
        organization_id: organizationId,
        branch_id: branchId,
        destination_location_id:
          destinationLocationId !== "none" ? destinationLocationId : undefined,
        scheduled_date: new Date(scheduledDate).toISOString(),
        source_document: sourceDocument,
        delivery_address: supplierAddress,
        responsible_user_id: currentUser.id,
        notes,
        items,
        supplier_id: selectedSupplierId || undefined,
        requires_verification: requiresVerification,
        wizard_step: 2, // Moving to step 2
      });

      setLoading(false);

      if (result.success && result.delivery_id) {
        setDeliveryId(result.delivery_id);
        setCurrentStep(2);

        // Update URL with draft ID if new draft
        if (!draftId) {
          router.replace(`/dashboard/warehouse/deliveries/new?draft=${result.delivery_id}`);
        }
      } else {
        toast.error(result.errors?.[0] || t("messages.error"));
      }
    }
  };

  const handleBack = () => {
    if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  const handleCompleteDelivery = async () => {
    if (items.length === 0) {
      toast.error(t("products.noProducts"));
      return;
    }

    if (!currentUser?.id) {
      toast.error("User not logged in");
      return;
    }

    setLoading(true);

    // Get supplier details for delivery_address
    const supplierAddress = selectedSupplier
      ? `${selectedSupplier.name}${selectedSupplier.address_line_1 ? `, ${selectedSupplier.address_line_1}` : ""}${selectedSupplier.city ? `, ${selectedSupplier.city}` : ""}${selectedSupplier.country ? `, ${selectedSupplier.country}` : ""}`
      : "";

    const result = await createDelivery({
      organization_id: organizationId,
      branch_id: branchId,
      destination_location_id: destinationLocationId !== "none" ? destinationLocationId : undefined,
      scheduled_date: new Date(scheduledDate).toISOString(),
      source_document: sourceDocument,
      delivery_address: supplierAddress,
      responsible_user_id: currentUser.id,
      notes,
      items,
      supplier_id: selectedSupplierId || undefined,
      requires_verification: requiresVerification,
    });

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

  const handleSupplierCreated = async () => {
    // Reload suppliers after creating new one
    await loadBranchData(branchId);
    // Auto-select the newly created supplier (it will be the most recent one)
    if (suppliers.length > 0) {
      const newestSupplier = suppliers[suppliers.length - 1];
      setSelectedSupplierId(newestSupplier.id);
    }
  };

  const deliverySteps: Step[] = [
    { label: t("statuses.pending"), value: "pending" },
    { label: t("statuses.approved"), value: "approved" },
    { label: t("statuses.completed"), value: "completed" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <button className="text-2xl text-muted-foreground hover:text-yellow-500">☆</button>
            <div>
              <h1 className="text-3xl font-bold">{t("new")}</h1>
              {deliveryId && (
                <p className="text-sm text-muted-foreground mt-1">
                  {t("statuses.draft")} - {currentStep === 1 ? "Step 1/2" : "Step 2/2"}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            {t("actions.cancel")}
          </Button>
          <Button variant="outline" onClick={handleSaveDraft} disabled={loading}>
            {loading ? t("actions.saving") : t("actions.saveAsDraft")}
          </Button>
          {currentStep === 1 && (
            <Button
              onClick={handleNext}
              disabled={loading}
              className="bg-[#8B4789] hover:bg-[#7A3E78]"
            >
              {t("actions.next")} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {currentStep === 2 && (
            <>
              <Button variant="outline" onClick={handleBack} disabled={loading}>
                <ArrowLeft className="mr-2 h-4 w-4" /> {t("actions.previous")}
              </Button>
              <Button
                onClick={handleCompleteDelivery}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700"
              >
                {loading ? t("actions.saving") : t("actions.completeDelivery")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status Stepper */}
      <div className="w-full">
        <StatusStepper
          steps={deliverySteps}
          activeStep={requiresVerification ? "pending" : "completed"}
          size="md"
        />
      </div>

      {/* Step 1: Delivery Information */}
      {currentStep === 1 && (
        <>
          {/* Verification Toggle */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <Checkbox
                id="requires-verification"
                checked={requiresVerification}
                onCheckedChange={(checked) => setRequiresVerification(checked as boolean)}
              />
              <div className="flex-1">
                <label
                  htmlFor="requires-verification"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {t("fields.enableVerification")}
                </label>
                <div className="flex items-start gap-2 mt-1">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    {requiresVerification
                      ? t("fields.verificationEnabledHelp")
                      : t("fields.verificationDisabledHelp")}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-6">
              <Card className="p-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Supplier/Vendor Selection */}
                  <div className="space-y-2 col-span-2">
                    <Label>{t("fields.supplier")}</Label>
                    <div className="flex gap-2">
                      <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder={t("form.selectSupplierPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              {t("form.noSuppliersFound")}
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
                        title={t("form.addNewSupplier")}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {selectedSupplier && (
                      <div className="mt-2 p-3 bg-muted/30 rounded border text-sm space-y-1">
                        <div className="font-medium">{selectedSupplier.name}</div>
                        {selectedSupplier.tax_number && (
                          <div className="text-muted-foreground">
                            NIP: {selectedSupplier.tax_number}
                          </div>
                        )}
                        {selectedSupplier.company_registration_number && (
                          <div className="text-muted-foreground">
                            REGON: {selectedSupplier.company_registration_number}
                          </div>
                        )}
                        {(selectedSupplier.address_line_1 || selectedSupplier.city) && (
                          <div className="text-muted-foreground">
                            {selectedSupplier.address_line_1 &&
                              `${selectedSupplier.address_line_1}, `}
                            {selectedSupplier.postal_code} {selectedSupplier.city}
                            {selectedSupplier.country && `, ${selectedSupplier.country}`}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {t("fields.destinationLocation")}
                      <span className="text-xs text-muted-foreground ml-2">
                        {t("form.optional")}
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
                      <p className="text-xs text-muted-foreground">
                        {t("form.moveToLocationInfo")}
                      </p>
                    )}
                    {(!destinationLocationId || destinationLocationId === "none") && (
                      <p className="text-xs text-yellow-600">
                        {t("form.receiveWithoutLocationInfo")}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t("fields.invoiceDate")}</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("fields.invoiceNumber")}</Label>
                    <Input
                      value={sourceDocument}
                      onChange={(e) => setSourceDocument(e.target.value)}
                      placeholder={t("form.invoiceNumberPlaceholder")}
                    />
                  </div>
                </div>
              </Card>

              {/* Show products table only if verification is enabled */}
              {requiresVerification && (
                <Tabs defaultValue="operations" className="w-full">
                  <TabsList>
                    <TabsTrigger value="operations">{t("tabs.operations")}</TabsTrigger>
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
              )}

              {/* Show notes directly if verification is disabled */}
              {!requiresVerification && (
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
              )}
            </div>

            {/* Right Column - Activity */}
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
                            {new Date().toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("form.activityDescription")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Step 2: Physical Registration/Verification */}
      {currentStep === 2 && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                {requiresVerification ? "Verification & Registration" : "Physical Registration"}
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                {requiresVerification
                  ? "Compare physical quantities with expected quantities and report any discrepancies."
                  : "Enter the physical quantities and items received."}
              </p>

              <DeliveryLineItems
                items={items}
                onChange={setItems}
                organizationId={organizationId}
              />
            </Card>

            <Card className="p-6">
              <div className="space-y-2">
                <Label>{t("fields.notes.label")}</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full min-h-[150px] p-3 border rounded-md"
                  placeholder={t("form.notesPlaceholder")}
                />
              </div>
            </Card>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Delivery Summary</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Supplier</p>
                  <p className="font-medium">{selectedSupplier?.name || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Invoice Number</p>
                  <p className="font-medium">{sourceDocument || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">
                    {destinationLocationId && destinationLocationId !== "none"
                      ? locations.find((l) => l.id === destinationLocationId)?.name
                      : "No location"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Products</p>
                  <p className="font-medium">{items.length} items</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Quantity</p>
                  <p className="font-medium">
                    {items.reduce((sum, item) => sum + item.expected_quantity, 0)} units
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Supplier Dialog */}
      <NewSupplierFormDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onSuccess={handleSupplierCreated}
      />
    </div>
  );
}
