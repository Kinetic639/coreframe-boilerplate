"use client";

// =============================================
// Delivery Debugger Component
// Development tool for inspecting delivery data
// =============================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getDelivery } from "@/app/actions/warehouse/get-delivery";
import { getDeliveries } from "@/app/actions/warehouse/get-deliveries";
import { createDelivery } from "@/app/actions/warehouse/create-delivery";
import type {
  DeliveryWithRelations,
  CreateDeliveryData,
} from "@/modules/warehouse/types/deliveries";
import { createClient } from "@/lib/supabase/client";

interface DeliveryDebuggerProps {
  organizationId: string;
  branchId: string;
}

export function DeliveryDebugger({ organizationId, branchId }: DeliveryDebuggerProps) {
  const [deliveryId, setDeliveryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [deliveryData, setDeliveryData] = useState<DeliveryWithRelations | null>(null);
  const [rawMovementData, setRawMovementData] = useState<any>(null);
  const [allDeliveries, setAllDeliveries] = useState<DeliveryWithRelations[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Inspect single delivery
  const handleInspectDelivery = async () => {
    if (!deliveryId.trim()) {
      setError("Please enter a delivery ID");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get delivery via action
      const delivery = await getDelivery(deliveryId.trim());
      setDeliveryData(delivery);

      // Get raw movement data directly from Supabase
      const supabase = createClient();
      const { data: movements, error: movementError } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("id", deliveryId.trim())
        .single();

      if (movementError) {
        console.error("Error fetching raw movement:", movementError);
      } else {
        setRawMovementData(movements);
      }

      if (!delivery) {
        setError("Delivery not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Load all deliveries
  const handleLoadAllDeliveries = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getDeliveries(organizationId, branchId, {}, 1, 100);
      setAllDeliveries(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Create test delivery
  const handleCreateTestDelivery = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Get a random product
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .eq("organization_id", organizationId)
        .limit(1);

      if (!products || products.length === 0) {
        setError("No products found. Create a product first.");
        setLoading(false);
        return;
      }

      const testData: CreateDeliveryData = {
        organization_id: organizationId,
        branch_id: branchId,
        scheduled_date: new Date().toISOString(),
        source_document: `TEST-PO-${Date.now()}`,
        delivery_address: "Test Vendor Corporation - Debug",
        notes: "This is a test delivery created by the debugger",
        items: [
          {
            product_id: products[0].id,
            expected_quantity: 10,
            unit_cost: 25.5,
          },
        ],
      };

      const result = await createDelivery(testData);

      if (result.success && result.delivery_id) {
        setDeliveryId(result.delivery_id);
        alert(
          `Test delivery created successfully!\nDelivery ID: ${result.delivery_id}\nDelivery Number: ${result.delivery_number}`
        );
        await handleInspectDelivery();
      } else {
        setError(result.errors?.join(", ") || "Failed to create test delivery");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Query raw stock movements
  const handleQueryRawMovements = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: movements, error: movementError } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("branch_id", branchId)
        .eq("movement_type_code", "101")
        .order("created_at", { ascending: false })
        .limit(10);

      if (movementError) {
        setError(movementError.message);
      } else {
        console.log("=== RAW STOCK MOVEMENTS (Type 101) ===");
        console.table(movements);
        console.log("Full data:", movements);
        alert(`Found ${movements?.length || 0} movements. Check console for details.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Delivery Debugger</h1>
        <p className="text-muted-foreground">
          Development tool for inspecting and testing delivery data
        </p>
      </div>

      <Tabs defaultValue="inspect" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="inspect">Inspect Delivery</TabsTrigger>
          <TabsTrigger value="list">All Deliveries</TabsTrigger>
          <TabsTrigger value="create">Create Test</TabsTrigger>
          <TabsTrigger value="raw">Raw Data</TabsTrigger>
        </TabsList>

        {/* Inspect Single Delivery */}
        <TabsContent value="inspect" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inspect Delivery by ID</CardTitle>
              <CardDescription>
                Enter a delivery ID (stock movement ID) to inspect its data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Delivery ID</Label>
                  <Input
                    value={deliveryId}
                    onChange={(e) => setDeliveryId(e.target.value)}
                    placeholder="e.g., 2528e03f-5fa5-45a9-bcb2-d5e7582fe82f"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleInspectDelivery} disabled={loading}>
                    {loading ? "Loading..." : "Inspect"}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
                  <strong>Error:</strong> {error}
                </div>
              )}

              {deliveryData && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded p-4">
                    <strong className="text-green-800">Delivery Found!</strong>
                  </div>

                  {/* Parsed Delivery Data */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Parsed Delivery Data (from getDelivery action)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 font-mono text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="font-semibold">Delivery Number:</div>
                          <div>{deliveryData.delivery_number}</div>

                          <div className="font-semibold">Status:</div>
                          <div>
                            <Badge>{deliveryData.status}</Badge>
                          </div>

                          <div className="font-semibold">Scheduled Date:</div>
                          <div className={!deliveryData.scheduled_date ? "text-red-600" : ""}>
                            {deliveryData.scheduled_date || "❌ MISSING"}
                          </div>

                          <div className="font-semibold">Delivery Address:</div>
                          <div className={!deliveryData.delivery_address ? "text-red-600" : ""}>
                            {deliveryData.delivery_address || "❌ MISSING"}
                          </div>

                          <div className="font-semibold">Source Document:</div>
                          <div className={!deliveryData.source_document ? "text-red-600" : ""}>
                            {deliveryData.source_document || "❌ MISSING"}
                          </div>

                          <div className="font-semibold">Destination Location:</div>
                          <div
                            className={
                              !deliveryData.destination_location_id ? "text-orange-600" : ""
                            }
                          >
                            {deliveryData.destination_location?.name ||
                              deliveryData.destination_location_id ||
                              "⚠️ NOT SET"}
                          </div>

                          <div className="font-semibold">Items Count:</div>
                          <div className={deliveryData.items.length === 0 ? "text-red-600" : ""}>
                            {deliveryData.items.length} items
                          </div>

                          <div className="font-semibold">Items with Details:</div>
                          <div
                            className={
                              !deliveryData.items_with_details?.length ? "text-red-600" : ""
                            }
                          >
                            {deliveryData.items_with_details?.length || 0} items
                          </div>
                        </div>
                      </div>

                      <details className="mt-4">
                        <summary className="cursor-pointer font-semibold text-blue-600 hover:text-blue-800">
                          Show Full JSON
                        </summary>
                        <pre className="mt-2 bg-gray-100 p-4 rounded overflow-auto max-h-96 text-xs">
                          {JSON.stringify(deliveryData, null, 2)}
                        </pre>
                      </details>
                    </CardContent>
                  </Card>

                  {/* Raw Movement Data */}
                  {rawMovementData && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Raw Stock Movement Data (from database)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 font-mono text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="font-semibold">occurred_at:</div>
                            <div className={!rawMovementData.occurred_at ? "text-red-600" : ""}>
                              {rawMovementData.occurred_at || "❌ NULL"}
                            </div>

                            <div className="font-semibold">reference_number:</div>
                            <div
                              className={!rawMovementData.reference_number ? "text-red-600" : ""}
                            >
                              {rawMovementData.reference_number || "❌ NULL"}
                            </div>

                            <div className="font-semibold">metadata:</div>
                            <div>
                              {rawMovementData.metadata ? (
                                <pre className="text-xs">
                                  {JSON.stringify(rawMovementData.metadata, null, 2)}
                                </pre>
                              ) : (
                                <span className="text-red-600">❌ NULL</span>
                              )}
                            </div>

                            <div className="font-semibold">destination_location_id:</div>
                            <div
                              className={
                                !rawMovementData.destination_location_id ? "text-orange-600" : ""
                              }
                            >
                              {rawMovementData.destination_location_id || "⚠️ NULL"}
                            </div>
                          </div>
                        </div>

                        <details className="mt-4">
                          <summary className="cursor-pointer font-semibold text-blue-600 hover:text-blue-800">
                            Show Full Raw JSON
                          </summary>
                          <pre className="mt-2 bg-gray-100 p-4 rounded overflow-auto max-h-96 text-xs">
                            {JSON.stringify(rawMovementData, null, 2)}
                          </pre>
                        </details>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Deliveries List */}
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Deliveries</CardTitle>
              <CardDescription>List of all deliveries in current branch</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleLoadAllDeliveries} disabled={loading}>
                {loading ? "Loading..." : "Load All Deliveries"}
              </Button>

              {allDeliveries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Found {allDeliveries.length} deliveries
                  </p>
                  <div className="space-y-2">
                    {allDeliveries.map((delivery) => (
                      <Card key={delivery.id} className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <strong>{delivery.delivery_number}</strong>
                              <Badge>{delivery.status}</Badge>
                            </div>
                            <div className="text-sm space-y-1">
                              <div>
                                <span className="text-muted-foreground">ID:</span>{" "}
                                <code className="text-xs bg-gray-100 px-1 rounded">
                                  {delivery.id}
                                </code>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Date:</span>{" "}
                                {delivery.scheduled_date ? (
                                  new Date(delivery.scheduled_date).toLocaleString()
                                ) : (
                                  <span className="text-red-600">MISSING</span>
                                )}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Address:</span>{" "}
                                {delivery.delivery_address || (
                                  <span className="text-red-600">MISSING</span>
                                )}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Source:</span>{" "}
                                {delivery.source_document || (
                                  <span className="text-red-600">MISSING</span>
                                )}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Items:</span>{" "}
                                {delivery.items.length} / {delivery.items_with_details?.length || 0}{" "}
                                with details
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDeliveryId(delivery.id);
                              handleInspectDelivery();
                            }}
                          >
                            Inspect
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Create Test Delivery */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Test Delivery</CardTitle>
              <CardDescription>
                Automatically create a test delivery with sample data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-800">
                  This will create a delivery with:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Random product from your inventory</li>
                    <li>Test vendor name: "Test Vendor Corporation - Debug"</li>
                    <li>Test PO number with timestamp</li>
                    <li>Quantity: 10 units @ 25.50 each</li>
                    <li>Current date/time</li>
                  </ul>
                </p>
              </div>

              <Button onClick={handleCreateTestDelivery} disabled={loading}>
                {loading ? "Creating..." : "Create Test Delivery"}
              </Button>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
                  <strong>Error:</strong> {error}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Raw Data Query */}
        <TabsContent value="raw" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Query Raw Stock Movements</CardTitle>
              <CardDescription>
                Direct database query of stock_movements table (type 101 = deliveries)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={handleQueryRawMovements} disabled={loading}>
                {loading ? "Querying..." : "Query Last 10 Movements"}
              </Button>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <p className="text-sm text-yellow-800">
                  Results will be logged to the browser console. Press F12 to open DevTools.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
