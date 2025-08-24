"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Plus, Loader2 } from "lucide-react";
import { createRole, type PermissionsByCategory } from "@/app/actions/roles/role-management";

interface RoleCreateDialogProps {
  allPermissions: PermissionsByCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function RoleCreateDialog({
  allPermissions,
  open,
  onOpenChange,
  onComplete,
}: RoleCreateDialogProps) {
  const t = useTranslations("organization.roleManagement");

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
  });
  const [selectedPermissions, setSelectedPermissions] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const resetForm = () => {
    setFormData({ name: "", description: "" });
    setSelectedPermissions(new Set());
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await createRole({
        name: formData.name.trim(),
        description: formData.description.trim(),
        permissionIds: Array.from(selectedPermissions),
      });

      if (result.success) {
        resetForm();
        onComplete();
      } else {
        setError(result.error || "Failed to create role");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permissionId: string) => {
    const newSelected = new Set(selectedPermissions);
    if (newSelected.has(permissionId)) {
      newSelected.delete(permissionId);
    } else {
      newSelected.add(permissionId);
    }
    setSelectedPermissions(newSelected);
  };

  const toggleCategoryPermissions = (categoryPermissions: any[], allSelected: boolean) => {
    const newSelected = new Set(selectedPermissions);
    categoryPermissions.forEach((permission) => {
      if (allSelected) {
        newSelected.delete(permission.id);
      } else {
        newSelected.add(permission.id);
      }
    });
    setSelectedPermissions(newSelected);
  };

  React.useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {t("createRole")}
          </DialogTitle>
          <DialogDescription>
            Create a new custom role with specific permissions for your organization
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto px-1">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t("roleName")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("roleNamePlaceholder")}
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">{t("roleDescription")}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("roleDescriptionPlaceholder")}
                  rows={3}
                />
              </div>
            </div>

            {/* Permissions */}
            <div>
              <Label className="text-base font-medium">{t("permissions")}</Label>
              <p className="mb-4 text-sm text-muted-foreground">{t("selectPermissions")}</p>

              <div className="space-y-4">
                {Object.entries(allPermissions).map(([category, permissions]) => {
                  const categorySelectedCount = permissions.filter((p) =>
                    selectedPermissions.has(p.id)
                  ).length;
                  const allSelected = categorySelectedCount === permissions.length;
                  const someSelected = categorySelectedCount > 0;

                  return (
                    <Card key={category}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={allSelected}
                              ref={(ref) => {
                                if (ref) {
                                  ref.indeterminate = someSelected && !allSelected;
                                }
                              }}
                              onCheckedChange={() =>
                                toggleCategoryPermissions(permissions, allSelected)
                              }
                            />
                            <span className="text-sm font-medium">
                              {t(`permissionCategories.${category}`) || category}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({categorySelectedCount}/{permissions.length})
                            </span>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {permissions.map((permission) => (
                            <div
                              key={permission.id}
                              className="flex items-start gap-2 rounded-md p-2 hover:bg-muted/50"
                            >
                              <Checkbox
                                checked={selectedPermissions.has(permission.id)}
                                onCheckedChange={() => togglePermission(permission.id)}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-mono text-sm">{permission.slug}</div>
                                {permission.description && (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {permission.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("saveRole")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
