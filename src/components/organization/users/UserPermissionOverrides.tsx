"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Key,
  Plus,
  Trash2,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  ShieldX,
  Loader2,
  AlertCircle,
  CheckCircle,
  Building2,
  Globe,
} from "lucide-react";
import {
  UserDetailWithAssignments,
  UserPermissionOverrideWithDetails,
} from "@/app/actions/users/fetch-user-detail";
import {
  upsertPermissionOverride,
  removePermissionOverride,
  fetchAvailablePermissions,
} from "@/lib/api/user-detail";
import { useAppStore } from "@/lib/stores/app-store";
import { useState, useEffect } from "react";

interface UserPermissionOverridesProps {
  user: UserDetailWithAssignments;
  onUpdate: () => void;
}

export function UserPermissionOverrides({ user, onUpdate }: UserPermissionOverridesProps) {
  const [availablePermissions, setAvailablePermissions] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { activeOrg, availableBranches } = useAppStore();

  const [newOverrideData, setNewOverrideData] = useState({
    permissionId: "",
    isGranted: true,
    branchId: null as string | null,
  });

  // Load available permissions
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const permissions = await fetchAvailablePermissions();
        setAvailablePermissions(permissions);
      } catch (err) {
        console.error("Failed to load permissions:", err);
      }
    };

    loadPermissions();
  }, []);

  const handleAddOverride = async () => {
    if (!newOverrideData.permissionId || !activeOrg?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      await upsertPermissionOverride(
        user.id,
        activeOrg.id,
        newOverrideData.permissionId,
        newOverrideData.isGranted,
        newOverrideData.branchId
      );

      setSuccess("Permission override added successfully");
      setIsAddDialogOpen(false);
      setNewOverrideData({
        permissionId: "",
        isGranted: true,
        branchId: null,
      });
      onUpdate();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add permission override");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveOverride = async (overrideId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await removePermissionOverride(overrideId);

      setSuccess("Permission override removed successfully");
      onUpdate();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove permission override");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleOverride = async (override: UserPermissionOverrideWithDetails) => {
    if (!activeOrg?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      await upsertPermissionOverride(
        user.id,
        activeOrg.id,
        override.permission_id,
        !override.allowed,
        override.scope === "branch" ? override.scope_id : null
      );

      setSuccess(`Permission ${!override.allowed ? "granted" : "denied"} successfully`);
      onUpdate();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update permission");
    } finally {
      setIsLoading(false);
    }
  };

  const getPermissionIcon = (slug: string) => {
    if (slug.includes("manage") || slug.includes("admin")) return Shield;
    if (slug.includes("view")) return Key;
    return Key;
  };

  const getOverrideBadge = (isGranted: boolean) => {
    return isGranted ? (
      <Badge variant="default" className="bg-green-500">
        <ShieldCheck className="mr-1 h-3 w-3" />
        Granted
      </Badge>
    ) : (
      <Badge variant="destructive">
        <ShieldX className="mr-1 h-3 w-3" />
        Denied
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Permission Overrides ({user.permissionOverrides?.length || 0})
              </CardTitle>
              <CardDescription>
                Grant or deny specific permissions that override role-based permissions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {success && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{success}</span>
                </div>
              )}
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Override
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Permission Override</DialogTitle>
                    <DialogDescription>
                      Grant or deny a specific permission for this user
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="permission">Permission</Label>
                      <Select
                        value={newOverrideData.permissionId}
                        onValueChange={(value) =>
                          setNewOverrideData((prev) => ({ ...prev, permissionId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a permission" />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePermissions.map((permission) => (
                            <SelectItem key={permission.id} value={permission.id}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{permission.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({permission.slug})
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="branch">Scope (Optional)</Label>
                      <Select
                        value={newOverrideData.branchId || "global"}
                        onValueChange={(value) =>
                          setNewOverrideData((prev) => ({
                            ...prev,
                            branchId: value === "global" ? null : value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="global">
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4" />
                              Organization-wide
                            </div>
                          </SelectItem>
                          {availableBranches.map((branch) => (
                            <SelectItem key={branch.branch_id} value={branch.branch_id}>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {branch.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="grant-permission">Grant Permission</Label>
                        <div className="text-sm text-muted-foreground">
                          {newOverrideData.isGranted
                            ? "Allow this permission"
                            : "Deny this permission"}
                        </div>
                      </div>
                      <Switch
                        id="grant-permission"
                        checked={newOverrideData.isGranted}
                        onCheckedChange={(checked) =>
                          setNewOverrideData((prev) => ({ ...prev, isGranted: checked }))
                        }
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setIsAddDialogOpen(false)}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddOverride}
                        disabled={!newOverrideData.permissionId || isLoading}
                      >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add Override
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!user.permissionOverrides || user.permissionOverrides.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Key className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="mb-2 text-lg font-medium">No permission overrides</p>
              <p className="mb-4 text-sm">
                This user inherits all permissions from their assigned roles.
              </p>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Override
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permission</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quick Toggle</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.permissionOverrides.map((override) => {
                  const Icon = getPermissionIcon(override.permission.slug);

                  return (
                    <TableRow key={override.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{override.permission.label}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {override.permission.slug}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {override.scope === "branch" ? (
                            <>
                              <Building2 className="h-4 w-4" />
                              <span className="text-sm">
                                {availableBranches.find((b) => b.branch_id === override.scope_id)
                                  ?.name || "Branch"}
                              </span>
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4" />
                              <span className="text-sm">Organization</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getOverrideBadge(override.allowed)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={override.allowed}
                          onCheckedChange={() => handleToggleOverride(override)}
                          disabled={isLoading}
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleRemoveOverride(override.id)}
                              disabled={isLoading}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove Override
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role-based Permissions Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role-based Permissions
          </CardTitle>
          <CardDescription>Permissions inherited from assigned roles (read-only)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">This user inherits permissions from the following roles:</p>
            <div className="flex flex-wrap gap-2">
              {user.roles?.map((roleAssignment) => (
                <Badge key={roleAssignment.id} variant="outline">
                  {roleAssignment.role.name} ({roleAssignment.scope})
                </Badge>
              )) || <span className="italic">No roles assigned</span>}
            </div>
            <p className="mt-3 text-xs">
              Permission overrides above will take precedence over role-based permissions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
