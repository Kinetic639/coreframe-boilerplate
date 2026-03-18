"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-toastify";
import { processDeliveryReceipt } from "@/app/actions/warehouse/process-delivery-receipt";
import {
  ProcessDeliveryReceiptInput,
  ReceiptType,
  DamageReason,
  DAMAGE_REASON_LABELS,
} from "@/lib/types/receipt-documents";
import { Package, AlertCircle, CheckCircle2, XCircle } from "lucide-react";

interface ReceiveDeliveryFormProps {
  deliveryId: string;
  deliveryItems: Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    variant_id: string | null;
    variant_name: string | null;
    quantity_ordered: number;
    unit: string;
    unit_cost: number | null;
    destination_location_id: string;
    location_name: string;
  }>;
  onSuccess?: () => void;
}

interface LineItemState {
  product_id: string;
  variant_id: string | null;
  quantity_ordered: number;
  quantity_received: number;
  quantity_damaged: number;
  unit: string;
  unit_cost: number | null;
  destination_location_id: string;
  damage_reason?: DamageReason;
  damage_notes?: string;
  notes?: string;
}

export function ReceiveDeliveryForm({
  deliveryId,
  deliveryItems,
  onSuccess,
}: ReceiveDeliveryFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [receiptType, setReceiptType] = useState<ReceiptType>("full");
  const [qualityCheckPassed, setQualityCheckPassed] = useState(true);
  const [qualityNotes, setQualityNotes] = useState("");
  const [receivingNotes, setReceivingNotes] = useState("");

  // Initialize line items state
  const [lineItems, setLineItems] = useState<LineItemState[]>(
    deliveryItems.map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity_ordered: item.quantity_ordered,
      quantity_received: item.quantity_ordered, // Default to full receipt
      quantity_damaged: 0,
      unit: item.unit,
      unit_cost: item.unit_cost,
      destination_location_id: item.destination_location_id,
    }))
  );

  const updateLineItem = (index: number, updates: Partial<LineItemState>) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...updates } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate quantities
      for (const item of lineItems) {
        if (item.quantity_received < 0 || item.quantity_damaged < 0) {
          toast.error("Quantities cannot be negative");
          setLoading(false);
          return;
        }
        if (item.quantity_damaged > item.quantity_received) {
          toast.error("Damaged quantity cannot exceed received quantity");
          setLoading(false);
          return;
        }
      }

      const input: ProcessDeliveryReceiptInput = {
        delivery_movement_id: deliveryId,
        receipt_type: receiptType,
        quality_check_passed: qualityCheckPassed,
        quality_notes: qualityNotes || undefined,
        receiving_notes: receivingNotes || undefined,
        items: lineItems,
      };

      const result = await processDeliveryReceipt(input);

      if (result.success) {
        toast.success(`Receipt ${result.receipt_number} created successfully!`);
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/dashboard/warehouse/deliveries/${deliveryId}`);
          router.refresh();
        }
      } else {
        toast.error(result.error || "Failed to process receipt");
      }
    } catch (error) {
      console.error("Error processing receipt:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const totalOrdered = lineItems.reduce((sum, item) => sum + item.quantity_ordered, 0);
  const totalReceived = lineItems.reduce((sum, item) => sum + item.quantity_received, 0);
  const totalDamaged = lineItems.reduce((sum, item) => sum + item.quantity_damaged, 0);
  const totalAccepted = totalReceived - totalDamaged;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Receipt Header */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="receipt-type">Receipt Type</Label>
              <Select
                value={receiptType}
                onValueChange={(value) => setReceiptType(value as ReceiptType)}
              >
                <SelectTrigger id="receipt-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Receipt</SelectItem>
                  <SelectItem value="partial">Partial Receipt</SelectItem>
                  <SelectItem value="final_partial">Final Partial Receipt</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {receiptType === "full" && "All items received, delivery complete"}
                {receiptType === "partial" && "Some items received, more shipments expected"}
                {receiptType === "final_partial" && "Final shipment, delivery complete"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Quality Control</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="qc-passed"
                  checked={qualityCheckPassed}
                  onCheckedChange={(checked) => setQualityCheckPassed(checked as boolean)}
                />
                <label
                  htmlFor="qc-passed"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Quality check passed
                </label>
              </div>
            </div>
          </div>

          {!qualityCheckPassed && (
            <div className="space-y-2">
              <Label htmlFor="quality-notes">Quality Notes</Label>
              <Textarea
                id="quality-notes"
                value={qualityNotes}
                onChange={(e) => setQualityNotes(e.target.value)}
                placeholder="Describe quality issues..."
                rows={2}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="receiving-notes">Receiving Notes</Label>
            <Textarea
              id="receiving-notes"
              value={receivingNotes}
              onChange={(e) => setReceivingNotes(e.target.value)}
              placeholder="Any additional notes about this receipt..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Products Received</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {deliveryItems.map((deliveryItem, index) => {
            const lineItem = lineItems[index];
            const hasDamage = lineItem.quantity_damaged > 0;
            const isShortDelivery = lineItem.quantity_received < lineItem.quantity_ordered;

            return (
              <div
                key={`${deliveryItem.product_id}-${deliveryItem.variant_id || "base"}`}
                className="space-y-3 rounded-lg border p-4"
              >
                {/* Product Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <Package className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <h4 className="font-medium">{deliveryItem.product_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        SKU: {deliveryItem.product_sku}
                        {deliveryItem.variant_name && ` • ${deliveryItem.variant_name}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Location: {deliveryItem.location_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {hasDamage && (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 h-3 w-3" />
                        Damaged
                      </Badge>
                    )}
                    {isShortDelivery && !hasDamage && (
                      <Badge variant="secondary">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Short
                      </Badge>
                    )}
                    {!hasDamage && !isShortDelivery && (
                      <Badge variant="default">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        OK
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Quantities */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Ordered</Label>
                    <Input
                      type="number"
                      value={lineItem.quantity_ordered}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`received-${index}`}>Received</Label>
                    <Input
                      id={`received-${index}`}
                      type="number"
                      min="0"
                      step="0.001"
                      value={lineItem.quantity_received}
                      onChange={(e) =>
                        updateLineItem(index, {
                          quantity_received: parseFloat(e.target.value) || 0,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`damaged-${index}`}>Damaged</Label>
                    <Input
                      id={`damaged-${index}`}
                      type="number"
                      min="0"
                      step="0.001"
                      max={lineItem.quantity_received}
                      value={lineItem.quantity_damaged}
                      onChange={(e) =>
                        updateLineItem(index, {
                          quantity_damaged: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Damage Details */}
                {hasDamage && (
                  <div className="space-y-3 rounded border border-destructive/20 bg-destructive/5 p-3">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`damage-reason-${index}`}>Damage Reason</Label>
                        <Select
                          value={lineItem.damage_reason}
                          onValueChange={(value) =>
                            updateLineItem(index, {
                              damage_reason: value as DamageReason,
                            })
                          }
                        >
                          <SelectTrigger id={`damage-reason-${index}`}>
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DAMAGE_REASON_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`damage-notes-${index}`}>Damage Notes</Label>
                        <Textarea
                          id={`damage-notes-${index}`}
                          value={lineItem.damage_notes || ""}
                          onChange={(e) =>
                            updateLineItem(index, {
                              damage_notes: e.target.value,
                            })
                          }
                          placeholder="Describe the damage..."
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Accepted Quantity Summary */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Accepted Quantity:</span>
                  <span className="font-medium">
                    {(lineItem.quantity_received - lineItem.quantity_damaged).toFixed(3)}{" "}
                    {lineItem.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Receipt Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Ordered</p>
              <p className="text-2xl font-bold">{totalOrdered.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Received</p>
              <p className="text-2xl font-bold">{totalReceived.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Damaged</p>
              <p className="text-2xl font-bold text-destructive">{totalDamaged.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Accepted</p>
              <p className="text-2xl font-bold text-green-600">{totalAccepted.toFixed(3)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Processing..." : "Complete Receipt"}
        </Button>
      </div>
    </form>
  );
}
