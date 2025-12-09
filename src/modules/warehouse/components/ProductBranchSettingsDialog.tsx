"use client";

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// FIXME: import { productBranchSettingsService } from "../api/product-branch-settings-service";
import type {
  ProductBranchSettings,
  ReorderCalculationMethod,
  UpdateProductBranchSettingsData,
} from "../types/product-branch-settings";

interface ProductBranchSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
  onSuccess?: () => void;
}

export function ProductBranchSettingsDialog({
  open,
  onOpenChange,
  productId,
  productName,
  branchId,
  branchName,
  onSuccess,
}: ProductBranchSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ProductBranchSettings | null>(null);

  // Form state
  const [formData, setFormData] = useState<UpdateProductBranchSettingsData>({
    reorder_point: undefined,
    max_stock_level: undefined,
    min_stock_level: undefined,
    reorder_quantity: undefined,
    reorder_calculation_method: undefined,
    track_inventory: true,
    send_low_stock_alerts: false,
    lead_time_days: undefined,
  });

  // Load existing settings
  useEffect(() => {
    if (open) {
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId, branchId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await productBranchSettingsService.getSettings(productId, branchId);

      if (data) {
        setSettings(data);
        setFormData({
          reorder_point: data.reorder_point ?? undefined,
          max_stock_level: data.max_stock_level ?? undefined,
          min_stock_level: data.min_stock_level ?? undefined,
          reorder_quantity: data.reorder_quantity ?? undefined,
          reorder_calculation_method: data.reorder_calculation_method ?? undefined,
          track_inventory: data.track_inventory,
          send_low_stock_alerts: data.send_low_stock_alerts,
          lead_time_days: data.lead_time_days ?? undefined,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load warehouse settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings) {
        // Update existing settings
        await productBranchSettingsService.updateSettings(productId, branchId, formData);
        toast.success(`Settings updated for ${branchName}`);
      } else {
        // Create new settings
        await productBranchSettingsService.upsertSettings({
          product_id: productId,
          branch_id: branchId,
          ...formData,
        });
        toast.success(`Settings created for ${branchName}`);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleNumberChange = (field: keyof UpdateProductBranchSettingsData, value: string) => {
    const numValue = value === "" ? undefined : parseFloat(value);
    setFormData((prev) => ({ ...prev, [field]: numValue }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Warehouse Settings: {branchName}</DialogTitle>
          <DialogDescription>
            Configure inventory thresholds for <strong>{productName}</strong> in this warehouse
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading settings...</div>
        ) : (
          <Tabs defaultValue="thresholds" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="thresholds">Inventory Thresholds</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>

            <TabsContent value="thresholds" className="space-y-4 mt-4">
              {/* Reorder Point */}
              <div className="space-y-2">
                <Label htmlFor="reorder_point">
                  Reorder Point
                  <span className="text-xs text-muted-foreground ml-2">
                    (When to trigger low stock alert)
                  </span>
                </Label>
                <Input
                  id="reorder_point"
                  type="number"
                  step="0.01"
                  value={formData.reorder_point ?? ""}
                  onChange={(e) => handleNumberChange("reorder_point", e.target.value)}
                  placeholder="e.g., 100"
                />
                <p className="text-xs text-muted-foreground">
                  Alert will be created when warehouse total stock falls below this level
                </p>
              </div>

              {/* Min Stock Level */}
              <div className="space-y-2">
                <Label htmlFor="min_stock_level">
                  Minimum Stock Level
                  <span className="text-xs text-muted-foreground ml-2">(Safety buffer)</span>
                </Label>
                <Input
                  id="min_stock_level"
                  type="number"
                  step="0.01"
                  value={formData.min_stock_level ?? ""}
                  onChange={(e) => handleNumberChange("min_stock_level", e.target.value)}
                  placeholder="e.g., 50"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum desired stock level below reorder point
                </p>
              </div>

              {/* Max Stock Level */}
              <div className="space-y-2">
                <Label htmlFor="max_stock_level">
                  Maximum Stock Level
                  <span className="text-xs text-muted-foreground ml-2">(Warehouse capacity)</span>
                </Label>
                <Input
                  id="max_stock_level"
                  type="number"
                  step="0.01"
                  value={formData.max_stock_level ?? ""}
                  onChange={(e) => handleNumberChange("max_stock_level", e.target.value)}
                  placeholder="e.g., 500"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum warehouse capacity for this product
                </p>
              </div>

              {/* Reorder Calculation Method */}
              <div className="space-y-2">
                <Label htmlFor="calculation_method">Reorder Calculation Method</Label>
                <Select
                  value={formData.reorder_calculation_method ?? ""}
                  onValueChange={(value: ReorderCalculationMethod) =>
                    setFormData((prev) => ({
                      ...prev,
                      reorder_calculation_method: value,
                    }))
                  }
                >
                  <SelectTrigger id="calculation_method">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed Quantity</SelectItem>
                    <SelectItem value="min_max">Min/Max Calculation</SelectItem>
                    <SelectItem value="auto">Auto (Demand-based)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.reorder_calculation_method === "fixed" &&
                    "Always order the fixed reorder quantity"}
                  {formData.reorder_calculation_method === "min_max" &&
                    "Order quantity = max - current stock"}
                  {formData.reorder_calculation_method === "auto" &&
                    "Calculate based on demand history (future feature)"}
                  {!formData.reorder_calculation_method &&
                    "How to calculate suggested order quantity"}
                </p>
              </div>

              {/* Reorder Quantity */}
              <div className="space-y-2">
                <Label htmlFor="reorder_quantity">
                  Reorder Quantity
                  <span className="text-xs text-muted-foreground ml-2">(Fixed method only)</span>
                </Label>
                <Input
                  id="reorder_quantity"
                  type="number"
                  step="0.01"
                  value={formData.reorder_quantity ?? ""}
                  onChange={(e) => handleNumberChange("reorder_quantity", e.target.value)}
                  placeholder="e.g., 200"
                  disabled={formData.reorder_calculation_method !== "fixed"}
                />
                <p className="text-xs text-muted-foreground">
                  Quantity to order when stock falls below reorder point (fixed method)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="preferences" className="space-y-4 mt-4">
              {/* Lead Time */}
              <div className="space-y-2">
                <Label htmlFor="lead_time_days">
                  Lead Time (Days)
                  <span className="text-xs text-muted-foreground ml-2">
                    (Supplier to this warehouse)
                  </span>
                </Label>
                <Input
                  id="lead_time_days"
                  type="number"
                  step="1"
                  value={formData.lead_time_days ?? ""}
                  onChange={(e) => handleNumberChange("lead_time_days", e.target.value)}
                  placeholder="e.g., 7"
                />
                <p className="text-xs text-muted-foreground">
                  Days required for replenishment to arrive at this warehouse
                </p>
              </div>

              {/* Track Inventory */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="track_inventory"
                  checked={formData.track_inventory}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      track_inventory: checked === true,
                    }))
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="track_inventory"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Track Inventory
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Enable inventory tracking for this product in this warehouse
                  </p>
                </div>
              </div>

              {/* Send Low Stock Alerts */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="send_low_stock_alerts"
                  checked={formData.send_low_stock_alerts}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      send_low_stock_alerts: checked === true,
                    }))
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="send_low_stock_alerts"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Send Low Stock Alerts
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Send notifications when stock falls below reorder point in this warehouse
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">
                  💡 Per-Warehouse Configuration
                </h4>
                <p className="text-sm text-blue-700">
                  These settings are specific to <strong>{branchName}</strong>. Each warehouse can
                  have different thresholds based on:
                </p>
                <ul className="text-sm text-blue-700 mt-2 ml-4 list-disc space-y-1">
                  <li>Local demand patterns</li>
                  <li>Storage capacity</li>
                  <li>Supplier proximity and lead times</li>
                  <li>Service level requirements</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
