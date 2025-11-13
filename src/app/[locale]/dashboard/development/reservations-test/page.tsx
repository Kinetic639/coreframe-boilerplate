"use client";

/**
 * Reservations Testing Tool
 * Development page for testing the hybrid reservation system
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-toastify";
import { reservationsService } from "@/modules/warehouse/api/reservations-service";
import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import { createClient } from "@/utils/supabase/client";
import type { StockReservation, AvailableInventory } from "@/modules/warehouse/types/reservations";

interface Product {
  id: string;
  name: string;
  sku: string;
}

interface Location {
  id: string;
  name: string;
  code: string;
}

export default function ReservationsTestPage() {
  const { activeOrgId, activeBranchId } = useAppStore();
  const { user } = useUserStore();
  const supabase = createClient();

  // State
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [availability, setAvailability] = useState<AvailableInventory | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [reserveQuantity, setReserveQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");

  // Load products with available inventory
  const loadProducts = async () => {
    if (!activeOrgId || !activeBranchId) return;

    try {
      // Step 1: Get distinct product IDs from availability view
      const { data: availabilityData, error: availabilityError } = await supabase
        .from("product_available_inventory")
        .select("product_id")
        .eq("organization_id", activeOrgId)
        .eq("branch_id", activeBranchId)
        .gt("available_quantity", 0);

      if (availabilityError) throw availabilityError;

      // Get unique product IDs
      const productIds = [...new Set(availabilityData?.map((item) => item.product_id))];

      if (productIds.length === 0) {
        setProducts([]);
        return;
      }

      // Step 2: Fetch product details
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, sku")
        .in("id", productIds)
        .eq("organization_id", activeOrgId);

      if (productsError) throw productsError;

      setProducts(productsData || []);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Failed to load products");
    }
  };

  // Load locations for selected product
  const loadLocationsForProduct = async (productId: string) => {
    if (!activeOrgId || !activeBranchId || !productId) return;

    try {
      // Step 1: Get location IDs from availability view
      const { data: availabilityData, error: availabilityError } = await supabase
        .from("product_available_inventory")
        .select("location_id")
        .eq("organization_id", activeOrgId)
        .eq("branch_id", activeBranchId)
        .eq("product_id", productId)
        .gt("available_quantity", 0);

      if (availabilityError) throw availabilityError;

      const locationIds = availabilityData?.map((item) => item.location_id) || [];

      if (locationIds.length === 0) {
        setLocations([]);
        setSelectedLocationId("");
        setAvailability(null);
        return;
      }

      // Step 2: Fetch location details
      const { data: locationsData, error: locationsError } = await supabase
        .from("locations")
        .select("id, name, code")
        .in("id", locationIds)
        .eq("organization_id", activeOrgId)
        .is("deleted_at", null);

      if (locationsError) throw locationsError;

      const locs = locationsData || [];
      setLocations(locs);

      // Reset location selection if current location is not available
      if (selectedLocationId && !locs.find((l) => l.id === selectedLocationId)) {
        setSelectedLocationId("");
        setAvailability(null);
      }
    } catch (error) {
      console.error("Error loading locations:", error);
      toast.error("Failed to load locations");
    }
  };

  // Load availability for selected product and location
  const loadAvailability = async () => {
    if (!activeOrgId || !activeBranchId || !selectedProductId || !selectedLocationId) {
      setAvailability(null);
      return;
    }

    try {
      const availability = await reservationsService.getAvailableInventory(
        activeOrgId,
        activeBranchId,
        selectedProductId,
        undefined,
        selectedLocationId
      );

      setAvailability(availability);
    } catch (error) {
      console.error("Error loading availability:", error);
      toast.error("Failed to load availability");
    }
  };

  // Load reservations
  const loadReservations = async () => {
    if (!activeOrgId) {
      toast.error("No organization selected");
      return;
    }

    setLoading(true);
    try {
      const data = await reservationsService.getReservations(
        { status: ["active", "partial", "fulfilled", "cancelled"] },
        activeOrgId,
        activeBranchId || undefined
      );
      setReservations(data);
    } catch (error) {
      toast.error("Failed to load reservations");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Create reservation
  const handleCreateReservation = async () => {
    if (!activeOrgId || !activeBranchId || !user?.id) {
      toast.error("Missing context");
      return;
    }

    if (!selectedProductId || !selectedLocationId || reserveQuantity <= 0) {
      toast.error("Please select product, location, and valid quantity");
      return;
    }

    setLoading(true);
    try {
      const result = await reservationsService.createReservation(
        {
          productId: selectedProductId,
          locationId: selectedLocationId,
          quantity: reserveQuantity,
          referenceType: "sales_order",
          reservedFor: `Test Reservation - Development Tool`,
          priority: 1,
          autoRelease: false,
          notes: notes || "Created from development testing tool",
        },
        {
          organizationId: activeOrgId,
          branchId: activeBranchId,
          userId: user.id,
        }
      );

      if (result.success) {
        toast.success("Reservation created successfully!");
        // Reset form
        setReserveQuantity(1);
        setNotes("");
        // Reload data
        await loadReservations();
        await loadAvailability();
      } else {
        toast.error(`Failed: ${result.error}`);
      }
    } catch (error) {
      toast.error("Error creating reservation");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Release reservation
  const handleReleaseReservation = async (reservationId: string, quantity: number) => {
    if (!user?.id) {
      toast.error("Missing user context");
      return;
    }

    setLoading(true);
    try {
      const result = await reservationsService.releaseReservation(
        {
          reservationId,
          quantity,
          notes: "Test release from development tool",
        },
        user.id
      );

      if (result.success) {
        toast.success("Reservation released successfully!");
        await loadReservations();
        await loadAvailability();
      } else {
        toast.error(`Failed: ${result.error}`);
      }
    } catch (error) {
      toast.error("Error releasing reservation");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Cancel reservation
  const handleCancelReservation = async (reservationId: string) => {
    if (!user?.id) {
      toast.error("Missing user context");
      return;
    }

    setLoading(true);
    try {
      const result = await reservationsService.cancelReservation(
        {
          reservationId,
          reason: "Test cancellation from development tool",
        },
        user.id
      );

      if (result.success) {
        toast.success("Reservation cancelled successfully!");
        await loadReservations();
        await loadAvailability();
      } else {
        toast.error(`Failed: ${result.error}`);
      }
    } catch (error) {
      toast.error("Error cancelling reservation");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    if (activeOrgId && activeBranchId) {
      loadProducts();
      loadReservations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, activeBranchId]);

  useEffect(() => {
    if (selectedProductId) {
      loadLocationsForProduct(selectedProductId);
    } else {
      setLocations([]);
      setSelectedLocationId("");
      setAvailability(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId]);

  useEffect(() => {
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, selectedLocationId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-500";
      case "partial":
        return "bg-yellow-500";
      case "fulfilled":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      case "expired":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reservations Testing Tool</h1>
        <p className="text-muted-foreground">
          Development tool for testing the hybrid reservation system
        </p>
      </div>

      {/* Create Reservation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create Test Reservation</CardTitle>
          <CardDescription>Select a product and location to create a reservation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger id="product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {products.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No products with available inventory found
                </p>
              )}
            </div>

            {/* Location Selection */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select
                value={selectedLocationId}
                onValueChange={setSelectedLocationId}
                disabled={!selectedProductId || locations.length === 0}
              >
                <SelectTrigger id="location">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name} ({location.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProductId && locations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No locations available for this product
                </p>
              )}
            </div>
          </div>

          {/* Availability Display */}
          {availability && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-semibold mb-2">Availability</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">On Hand</p>
                  <p className="text-lg font-semibold">{availability.quantityOnHand}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reserved</p>
                  <p className="text-lg font-semibold text-yellow-600">
                    {availability.reservedQuantity}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Available</p>
                  <p className="text-lg font-semibold text-green-600">
                    {availability.availableQuantity}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity to Reserve</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={availability?.availableQuantity || 999}
              value={reserveQuantity}
              onChange={(e) => setReserveQuantity(Number(e.target.value))}
              disabled={!availability}
            />
            {availability && reserveQuantity > availability.availableQuantity && (
              <p className="text-sm text-red-600">
                Quantity exceeds available stock ({availability.availableQuantity})
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this reservation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Selected Info */}
          {selectedProduct && selectedLocation && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Product:</strong> {selectedProduct.name} ({selectedProduct.sku})
              </p>
              <p>
                <strong>Location:</strong> {selectedLocation.name} ({selectedLocation.code})
              </p>
              <p>
                <strong>Quantity:</strong> {reserveQuantity}
              </p>
            </div>
          )}

          {/* Create Button */}
          <Button
            onClick={handleCreateReservation}
            disabled={
              loading ||
              !selectedProductId ||
              !selectedLocationId ||
              !availability ||
              reserveQuantity <= 0 ||
              reserveQuantity > availability.availableQuantity
            }
            className="w-full"
          >
            Create Reservation
          </Button>
        </CardContent>
      </Card>

      {/* Reservations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Reservations ({reservations.length})</CardTitle>
              <CardDescription>All reservations in the system</CardDescription>
            </div>
            <Button onClick={loadReservations} variant="outline" size="sm" disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reservations found. Create one to test!
            </div>
          ) : (
            <div className="space-y-4">
              {reservations.map((reservation) => (
                <div key={reservation.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{reservation.reservation_number}</span>
                        <Badge className={getStatusColor(reservation.status)}>
                          {reservation.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{reservation.reserved_for}</p>
                      <div className="text-sm space-y-1">
                        <p>
                          <strong>Quantity:</strong> {reservation.reserved_quantity} (Released:{" "}
                          {reservation.released_quantity})
                        </p>
                        <p>
                          <strong>Remaining:</strong>{" "}
                          {reservation.reserved_quantity - reservation.released_quantity}
                        </p>
                        <p>
                          <strong>Type:</strong> {reservation.reference_type}
                        </p>
                        {reservation.reference_number && (
                          <p>
                            <strong>Reference:</strong> {reservation.reference_number}
                          </p>
                        )}
                        {reservation.notes && (
                          <p>
                            <strong>Notes:</strong> {reservation.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {(reservation.status === "active" || reservation.status === "partial") && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleReleaseReservation(
                                reservation.id,
                                Math.min(
                                  5,
                                  reservation.reserved_quantity - reservation.released_quantity
                                )
                              )
                            }
                            disabled={loading}
                          >
                            Release (5)
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCancelReservation(reservation.id)}
                            disabled={loading}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h3 className="font-semibold mb-2">Hybrid Reservation Model</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Operational state stored in stock_reservations table</li>
              <li>Event log (RES/UNRES) stored in stock_movements table</li>
              <li>Double-write pattern ensures consistency</li>
              <li>Available inventory = on_hand - reserved</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Workflow</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Select product with available inventory</li>
              <li>Choose location where product is available</li>
              <li>Set quantity to reserve (validates against available stock)</li>
              <li>
                Create reservation: validates availability, creates record + RES movement (501)
              </li>
              <li>Release reservation: updates record, creates UNRES movement (502)</li>
              <li>Cancel reservation: marks cancelled, creates UNRES movement for remaining qty</li>
            </ol>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Sales Order Integration</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Reservations created automatically when order status → confirmed</li>
              <li>Reservations cancelled when order → cancelled</li>
              <li>Reservations released when items are fulfilled/shipped</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
