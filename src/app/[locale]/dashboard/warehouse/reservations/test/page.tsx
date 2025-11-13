"use client";

/**
 * Reservations Testing Tool
 * Development page for testing the hybrid reservation system
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-toastify";
import { reservationsService } from "@/modules/warehouse/api/reservations-service";
import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";
import type { StockReservation } from "@/modules/warehouse/types/reservations";

export default function ReservationsTestPage() {
  const { activeOrg, activeBranch, activeOrgId, activeBranchId } = useAppStore();
  const { user } = useUserStore();
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [loading, setLoading] = useState(false);

  // Test data - replace with your actual product/location IDs
  const testProductId = "test-product-id";
  const testLocationId = "test-location-id";

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
      toast.success(`Loaded ${data.length} reservations`);
    } catch (error) {
      toast.error("Failed to load reservations");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const testCreateReservation = async () => {
    if (!activeOrgId || !activeBranchId || !user?.id) {
      toast.error("Missing context");
      return;
    }

    setLoading(true);
    try {
      const result = await reservationsService.createReservation(
        {
          productId: testProductId,
          locationId: testLocationId,
          quantity: 10,
          referenceType: "sales_order",
          reservedFor: "Test Reservation - Sales Order #TEST-001",
          priority: 1,
          autoRelease: false,
          notes: "This is a test reservation created from the development tool",
        },
        {
          organizationId: activeOrgId,
          branchId: activeBranchId,
          userId: user.id,
        }
      );

      if (result.success) {
        toast.success("Reservation created successfully!");
        await loadReservations();
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

  const testReleaseReservation = async (reservationId: string) => {
    if (!user?.id) {
      toast.error("Missing user context");
      return;
    }

    setLoading(true);
    try {
      const result = await reservationsService.releaseReservation(
        {
          reservationId,
          quantity: 5,
          notes: "Test release - partial fulfillment",
        },
        user.id
      );

      if (result.success) {
        toast.success("Reservation released successfully!");
        await loadReservations();
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

  const testCancelReservation = async (reservationId: string) => {
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

  const testCheckAvailability = async () => {
    if (!activeOrgId || !activeBranchId) {
      toast.error("Missing context");
      return;
    }

    setLoading(true);
    try {
      const availability = await reservationsService.getAvailableInventory(
        activeOrgId,
        activeBranchId,
        testProductId,
        undefined,
        testLocationId
      );

      if (availability) {
        toast.success(
          `Available: ${availability.availableQuantity} (On Hand: ${availability.quantityOnHand}, Reserved: ${availability.reservedQuantity})`
        );
      } else {
        toast.info("No inventory found at this location");
      }
    } catch (error) {
      toast.error("Error checking availability");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeOrgId) {
      loadReservations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, activeBranchId]);

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reservations Testing Tool</h1>
        <p className="text-muted-foreground">
          Development tool for testing the hybrid reservation system
        </p>
      </div>

      {/* Test Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Test Actions</CardTitle>
          <CardDescription>
            Note: Update testProductId and testLocationId with valid IDs from your database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={testCreateReservation} disabled={loading}>
              Create Test Reservation
            </Button>
            <Button onClick={testCheckAvailability} disabled={loading} variant="outline">
              Check Availability
            </Button>
            <Button onClick={loadReservations} disabled={loading} variant="outline">
              Refresh List
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>
              <strong>Test Product ID:</strong> {testProductId}
            </p>
            <p>
              <strong>Test Location ID:</strong> {testLocationId}
            </p>
            <p>
              <strong>Organization:</strong> {activeOrg?.name || "None"}
            </p>
            <p>
              <strong>Branch:</strong> {activeBranch?.name || "None"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Reservations List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Reservations ({reservations.length})</CardTitle>
          <CardDescription>All reservations in the system</CardDescription>
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
                    <div className="space-y-1">
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
                    <div className="flex gap-2">
                      {(reservation.status === "active" || reservation.status === "partial") && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => testReleaseReservation(reservation.id)}
                            disabled={loading}
                          >
                            Release (5)
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => testCancelReservation(reservation.id)}
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
