"use client";

import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Warehouse, Settings, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ProductBranchSettingsDialog } from "./ProductBranchSettingsDialog";
import { productBranchSettingsService } from "../api/product-branch-settings-service";
import type { ProductBranchSettings } from "../types/product-branch-settings";

interface ProductBranchSettingsListProps {
  productId: string;
  productName: string;
  branches: Array<{ id: string; name: string }>;
}

export function ProductBranchSettingsList({
  productId,
  productName,
  branches,
}: ProductBranchSettingsListProps) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ProductBranchSettings[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await productBranchSettingsService.getSettingsForProduct(productId);
      setSettings(data);
    } catch (error) {
      console.error("Error loading branch settings:", error);
      toast.error("Failed to load warehouse settings");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSettings = (branchId: string, branchName: string) => {
    setSelectedBranch({ id: branchId, name: branchName });
    setDialogOpen(true);
  };

  const getBranchSettings = (branchId: string) => {
    return settings.find((s) => s.branch_id === branchId);
  };

  const hasSettings = (branchId: string) => {
    const branchSettings = getBranchSettings(branchId);
    return (
      branchSettings &&
      (branchSettings.reorder_point !== null || branchSettings.max_stock_level !== null)
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading warehouse settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Warehouse-Specific Settings
          </CardTitle>
          <CardDescription>
            Configure different inventory thresholds for each warehouse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {branches.map((branch) => {
              const branchSettings = getBranchSettings(branch.id);
              const configured = hasSettings(branch.id);

              return (
                <div
                  key={branch.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0">
                      <Warehouse className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{branch.name}</h4>
                        {configured ? (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Configured
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Not Configured
                          </Badge>
                        )}
                      </div>

                      {branchSettings && configured ? (
                        <div className="text-sm text-muted-foreground space-y-0.5">
                          <div className="flex items-center gap-4">
                            {branchSettings.reorder_point !== null && (
                              <span>
                                Reorder Point: <strong>{branchSettings.reorder_point}</strong>
                              </span>
                            )}
                            {branchSettings.max_stock_level !== null && (
                              <span>
                                Max Level: <strong>{branchSettings.max_stock_level}</strong>
                              </span>
                            )}
                            {branchSettings.reorder_calculation_method && (
                              <span>
                                Method:{" "}
                                <strong className="capitalize">
                                  {branchSettings.reorder_calculation_method.replace("_", " ")}
                                </strong>
                              </span>
                            )}
                          </div>
                          {branchSettings.lead_time_days !== null && (
                            <span>
                              Lead Time: <strong>{branchSettings.lead_time_days} days</strong>
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No specific thresholds configured for this warehouse
                        </p>
                      )}
                    </div>

                    <Button
                      variant={configured ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleEditSettings(branch.id, branch.name)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {configured ? "Edit" : "Configure"}
                    </Button>
                  </div>
                </div>
              );
            })}

            {branches.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Warehouse className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No warehouses found</p>
                <p className="text-sm">Create warehouses in Organization Settings</p>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              💡 Why configure per-warehouse settings?
            </h4>
            <ul className="text-sm text-blue-700 space-y-1 ml-4 list-disc">
              <li>Different warehouses serve different regions with varying demand</li>
              <li>Storage capacity varies between facilities</li>
              <li>Supplier proximity affects lead times and optimal stock levels</li>
              <li>Service level requirements may differ by location</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {selectedBranch && (
        <ProductBranchSettingsDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          productId={productId}
          productName={productName}
          branchId={selectedBranch.id}
          branchName={selectedBranch.name}
          onSuccess={loadSettings}
        />
      )}
    </>
  );
}
