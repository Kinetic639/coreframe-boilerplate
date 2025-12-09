"use client";

import * as React from "react";
import { useAppStore } from "@/lib/stores/app-store";
// FIXME: import { UnitsService } from "../../api/units-service";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AddUnitDialog } from "./add-unit-dialog";
import { toast } from "react-toastify";
import type { UnitOfMeasure } from "../../types/units";

export function UnitsOfMeasurePage() {
  const { activeOrgId } = useAppStore();
  const [units, setUnits] = React.useState<UnitOfMeasure[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customSymbol, setCustomSymbol] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (activeOrgId) {
      loadUnits();
    }
  }, [activeOrgId]);

  async function loadUnits() {
    if (!activeOrgId) return;

    try {
      setIsLoading(true);
      const data = await UnitsService.getUnits(activeOrgId);
      setUnits(data);
    } catch (error) {
      console.error("Failed to load units:", error);
      toast.error("Failed to load units of measure");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateUnit(data: { name: string; symbol?: string }) {
    if (!activeOrgId) return;

    try {
      const newUnit = await UnitsService.createUnit({
        organization_id: activeOrgId,
        name: data.name,
        symbol: data.symbol,
      });

      // Update state directly to avoid flickering
      setUnits((prev) => [...prev, newUnit]);
      toast.success("Unit added successfully");
    } catch (error) {
      console.error("Failed to create unit:", error);
      toast.error("Failed to create unit");
      throw error;
    }
  }

  async function handleAddCustomUnit() {
    if (!customName.trim()) return;

    setIsSubmitting(true);
    try {
      await handleCreateUnit({
        name: customName.trim(),
        symbol: customSymbol.trim() || undefined,
      });

      // Reset form
      setCustomName("");
      setCustomSymbol("");
    } catch (error) {
      console.error("Failed to add custom unit:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteUnit(unitId: string, unitName: string) {
    if (!confirm(`Are you sure you want to delete "${unitName}"?`)) {
      return;
    }

    try {
      await UnitsService.deleteUnit(unitId);
      toast.success("Unit deleted successfully");
      loadUnits();
    } catch (error) {
      console.error("Failed to delete unit:", error);
      toast.error("Failed to delete unit");
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Units of Measure</h1>
          <p className="text-sm text-muted-foreground">Manage units for your organization</p>
        </div>
      </div>

      {/* Units Table */}
      {units.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="mb-3 text-center text-sm text-muted-foreground">No units of measure yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Symbol</th>
                <th className="w-24 px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {units.map((unit) => (
                <tr key={unit.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2">{unit.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{unit.symbol || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled
                        title="Edit (coming soon)"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteUnit(unit.id, unit.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Custom Unit Form */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Add Custom Unit</label>
            <input
              type="text"
              placeholder="Unit name"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customName.trim()) {
                  handleAddCustomUnit();
                }
              }}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <div className="w-32 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Symbol</label>
            <input
              type="text"
              placeholder="Symbol"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customName.trim()) {
                  handleAddCustomUnit();
                }
              }}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddCustomUnit}
            disabled={!customName.trim() || isSubmitting}
            className="h-9"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddDialog(true)}
            className="h-9"
          >
            Quick Pick
          </Button>
        </div>
      </div>

      {/* Add Unit Dialog */}
      <AddUnitDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={handleCreateUnit}
        existingUnits={units}
      />
    </div>
  );
}
