"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import { useWarehouseActivityLogger } from "@/modules/warehouse/hooks/useWarehouseActivityLogger";
import { ACTION_SLUGS, ENTITY_TYPE_SLUGS, MODULE_SLUGS } from "@/types/activities";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TestActivityPage() {
  const { logActivity } = useActivityLogger();
  const { logProductCreated, logLocationCreated, logStockAdjustment } =
    useWarehouseActivityLogger();

  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Generic activity logging
  const [genericForm, setGenericForm] = useState({
    moduleSlug: "",
    entityTypeSlug: "",
    actionSlug: "",
    entityId: "",
    description: "",
  });

  // Warehouse specific tests
  const [warehouseForm, setWarehouseForm] = useState({
    productId: "",
    productName: "",
    locationId: "",
    locationName: "",
  });

  const handleGenericLog = async () => {
    setIsLoading(true);
    try {
      const activityId = await logActivity(genericForm);
      setStatus(`✅ Activity logged successfully! ID: ${activityId}`);
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    setIsLoading(false);
  };

  const handleWarehouseProductTest = async () => {
    setIsLoading(true);
    try {
      const activityId = await logProductCreated(
        warehouseForm.productId || "test-product-1",
        warehouseForm.productName || "Test Product",
        { testData: true, timestamp: new Date().toISOString() }
      );
      setStatus(`✅ Warehouse product activity logged! ID: ${activityId}`);
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    setIsLoading(false);
  };

  const handleWarehouseLocationTest = async () => {
    setIsLoading(true);
    try {
      const activityId = await logLocationCreated(
        warehouseForm.locationId || "test-location-1",
        warehouseForm.locationName || "Test Location",
        undefined,
        { testData: true, timestamp: new Date().toISOString() }
      );
      setStatus(`✅ Warehouse location activity logged! ID: ${activityId}`);
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    setIsLoading(false);
  };

  const handleStockAdjustmentTest = async () => {
    setIsLoading(true);
    try {
      const activityId = await logStockAdjustment(
        "test-adjustment-1",
        "test-variant-1",
        "test-location-1",
        10,
        15,
        "Test adjustment for demo",
        { testData: true }
      );
      setStatus(`✅ Stock adjustment activity logged! ID: ${activityId}`);
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity System Test</h1>
        <p className="text-muted-foreground">
          Test the activity logging system with various scenarios
        </p>
      </div>

      {/* Status */}
      {status && (
        <Alert>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Generic Activity Test */}
        <Card>
          <CardHeader>
            <CardTitle>Generic Activity Logger</CardTitle>
            <CardDescription>Test the basic activity logging functionality</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Module</Label>
              <Select
                onValueChange={(value) =>
                  setGenericForm((prev) => ({ ...prev, moduleSlug: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select module" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MODULE_SLUGS).map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Entity Type</Label>
              <Select
                onValueChange={(value) =>
                  setGenericForm((prev) => ({ ...prev, entityTypeSlug: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ENTITY_TYPE_SLUGS).map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Action</Label>
              <Select
                onValueChange={(value) =>
                  setGenericForm((prev) => ({ ...prev, actionSlug: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_SLUGS).map(([key, value]) => (
                    <SelectItem key={key} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Entity ID</Label>
              <Input
                placeholder="test-entity-123"
                value={genericForm.entityId}
                onChange={(e) => setGenericForm((prev) => ({ ...prev, entityId: e.target.value }))}
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what happened..."
                value={genericForm.description}
                onChange={(e) =>
                  setGenericForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>

            <Button onClick={handleGenericLog} disabled={isLoading} className="w-full">
              Log Generic Activity
            </Button>
          </CardContent>
        </Card>

        {/* Warehouse Specific Tests */}
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Activity Tests</CardTitle>
            <CardDescription>Test warehouse-specific activity logging</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Product ID</Label>
              <Input
                placeholder="test-product-1"
                value={warehouseForm.productId}
                onChange={(e) =>
                  setWarehouseForm((prev) => ({ ...prev, productId: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Product Name</Label>
              <Input
                placeholder="Test Product"
                value={warehouseForm.productName}
                onChange={(e) =>
                  setWarehouseForm((prev) => ({ ...prev, productName: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Location ID</Label>
              <Input
                placeholder="test-location-1"
                value={warehouseForm.locationId}
                onChange={(e) =>
                  setWarehouseForm((prev) => ({ ...prev, locationId: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Location Name</Label>
              <Input
                placeholder="Test Location"
                value={warehouseForm.locationName}
                onChange={(e) =>
                  setWarehouseForm((prev) => ({ ...prev, locationName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Button onClick={handleWarehouseProductTest} disabled={isLoading} className="w-full">
                Test Product Created
              </Button>
              <Button
                onClick={handleWarehouseLocationTest}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                Test Location Created
              </Button>
              <Button
                onClick={handleStockAdjustmentTest}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                Test Stock Adjustment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p>
              <strong>Before testing:</strong>
            </p>
            <ul className="ml-4 list-inside list-disc space-y-1">
              <li>Make sure the database migrations have been run</li>
              <li>Ensure you're part of an organization with proper permissions</li>
              <li>Check that the activity modules, entity types, and actions are seeded</li>
            </ul>

            <p>
              <strong>Expected behavior:</strong>
            </p>
            <ul className="ml-4 list-inside list-disc space-y-1">
              <li>Activities should be logged with normalized references</li>
              <li>The activity ID should be returned on success</li>
              <li>You should see the activities in the Activity Log page</li>
              <li>The Recent Activities widget should update</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
