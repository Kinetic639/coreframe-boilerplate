// =============================================
// Create New Stock Movement Page
// Professional form for creating warehouse movements
// Based on AutoStacja UI pattern with tabs
// =============================================

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, FileText, Package } from "lucide-react";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import { MovementPositionsTable } from "@/modules/warehouse/components/movement-positions-table";
import { getMovementTypes } from "@/app/actions/warehouse/get-movement-types";
import type { Database } from "@/../supabase/types/types";
import { useLocale } from "next-intl";

type MovementType = Database["public"]["Tables"]["movement_types"]["Row"];

interface MovementPosition {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  source_location_id?: string;
  destination_location_id?: string;
  notes?: string;
}

export default function NewMovementPage() {
  const router = useRouter();
  const locale = useLocale();
  const { activeBranch, availableBranches } = useAppStore();

  // Form state
  const [activeTab, setActiveTab] = useState("basic");
  const [loading, setLoading] = useState(false);
  const [movementTypes, setMovementTypes] = useState<MovementType[]>([]);
  // Basic data
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedMovementType, setSelectedMovementType] = useState<string>("");
  const [destinationBranch, setDestinationBranch] = useState<string>("");
  const [documentNumber, setDocumentNumber] = useState<string>("");
  const [documentDate, setDocumentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState<string>("");

  // Positions
  const [positions, setPositions] = useState<MovementPosition[]>([]);

  // Selected movement type details
  const selectedType = movementTypes.find((mt) => mt.code === selectedMovementType);
  const requiresDestination = selectedType?.requires_destination_location || false;
  const requiresApproval = selectedType?.requires_approval || false;
  const requiresRequest = selectedType?.requires_movement_request || false;

  useEffect(() => {
    if (activeBranch?.id) {
      setSelectedBranch(activeBranch.id);
    }
  }, [activeBranch]);

  useEffect(() => {
    loadMovementTypes();
  }, []);

  const loadMovementTypes = async () => {
    try {
      const result = await getMovementTypes();
      if (result.success) {
        setMovementTypes(result.data);
      } else {
        toast.error(result.error || "Failed to load movement types");
      }
    } catch (error) {
      console.error("Error loading movement types:", error);
      toast.error("Failed to load movement types");
    }
  };

  const handleAddPosition = (position: MovementPosition) => {
    setPositions([...positions, position]);
  };

  const handleRemovePosition = (index: number) => {
    setPositions(positions.filter((_, i) => i !== index));
  };

  const handleUpdatePosition = (index: number, updated: MovementPosition) => {
    setPositions(positions.map((p, i) => (i === index ? updated : p)));
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedBranch) {
      toast.error("Please select a warehouse/branch");
      return;
    }

    if (!selectedMovementType) {
      toast.error("Please select movement type");
      return;
    }

    if (requiresDestination && !destinationBranch) {
      toast.error("Please select destination warehouse/branch");
      return;
    }

    if (positions.length === 0) {
      toast.error("Please add at least one item");
      setActiveTab("positions");
      return;
    }

    try {
      setLoading(true);

      // TODO: Create server action to create movement/request
      // const result = await createMovement({
      //   branch_id: selectedBranch,
      //   movement_type_code: selectedMovementType,
      //   destination_branch_id: destinationBranch || null,
      //   document_number: documentNumber,
      //   document_date: documentDate,
      //   notes,
      //   positions,
      // });

      toast.success(
        requiresRequest ? "Movement request created successfully" : "Movement created successfully"
      );

      router.push("/dashboard/warehouse/inventory/movements");
    } catch (error) {
      console.error("Error creating movement:", error);
      toast.error("Failed to create movement");
    } finally {
      setLoading(false);
    }
  };

  const canProceedToPositions =
    selectedBranch && selectedMovementType && (!requiresDestination || destinationBranch);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Warehouse Movement</h1>
            <p className="text-muted-foreground">Create a new stock movement or transfer request</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || positions.length === 0}>
            <Save className="h-4 w-4 mr-2" />
            {requiresRequest ? "Create Request" : "Create Movement"}
          </Button>
        </div>
      </div>

      {/* Movement Type Info */}
      {selectedType && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {selectedType.polish_document_type} -{" "}
                  {locale === "pl" ? selectedType.name_pl : selectedType.name}
                </CardTitle>
                <CardDescription>{selectedType.description}</CardDescription>
              </div>
              <div className="flex gap-2">
                {requiresApproval && <Badge variant="secondary">Requires Approval</Badge>}
                {requiresRequest && <Badge variant="secondary">Request Workflow</Badge>}
                {selectedType.creates_reservation && (
                  <Badge variant="outline">Creates Reservation</Badge>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Main Form */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Basic Data
              </TabsTrigger>
              <TabsTrigger
                value="positions"
                disabled={!canProceedToPositions}
                className="flex items-center gap-2"
              >
                <Package className="h-4 w-4" />
                Positions
                {positions.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {positions.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            <TabsContent value="basic" className="space-y-6">
              {/* Source Warehouse/Branch */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source-branch">
                    Source Warehouse / Branch <span className="text-red-500">*</span>
                  </Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger id="source-branch">
                      <SelectValue placeholder="Select source warehouse..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Movement Type */}
                <div className="space-y-2">
                  <Label htmlFor="movement-type">
                    Movement Type <span className="text-red-500">*</span>
                  </Label>
                  <Select value={selectedMovementType} onValueChange={setSelectedMovementType}>
                    <SelectTrigger id="movement-type">
                      <SelectValue placeholder="Select movement type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {movementTypes.map((type) => (
                        <SelectItem key={type.code} value={type.code}>
                          {type.polish_document_type} - {locale === "pl" ? type.name_pl : type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Destination Warehouse/Branch (if required) */}
              {requiresDestination && (
                <div className="space-y-2">
                  <Label htmlFor="dest-branch">
                    Destination Warehouse / Branch <span className="text-red-500">*</span>
                  </Label>
                  <Select value={destinationBranch} onValueChange={setDestinationBranch}>
                    <SelectTrigger id="dest-branch">
                      <SelectValue placeholder="Select destination warehouse..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBranches
                        .filter((b) => b.id !== selectedBranch)
                        .map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Document Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doc-number">Document Number</Label>
                  <Input
                    id="doc-number"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    placeholder="Auto-generated if empty"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="doc-date">
                    Document Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="doc-date"
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter any additional notes..."
                  rows={4}
                />
              </div>

              {/* Next Button */}
              <div className="flex justify-end">
                <Button onClick={() => setActiveTab("positions")} disabled={!canProceedToPositions}>
                  Next: Add Positions
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="positions" className="space-y-4">
              <MovementPositionsTable
                positions={positions}
                sourceBranchId={selectedBranch}
                destinationBranchId={destinationBranch}
                onAdd={handleAddPosition}
                onRemove={handleRemovePosition}
                onUpdate={handleUpdatePosition}
              />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
