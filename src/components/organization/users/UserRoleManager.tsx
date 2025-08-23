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
  Shield,
  Plus,
  Trash2,
  MoreHorizontal,
  Crown,
  Building2,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { UserDetailWithAssignments } from "@/app/actions/users/fetch-user-detail";
import { assignUserRole, removeUserRole, fetchAvailableRoles } from "@/lib/api/user-detail";
import { useAppStore } from "@/lib/stores/app-store";
import { useState, useEffect } from "react";

interface UserRoleManagerProps {
  user: UserDetailWithAssignments;
  onUpdate: () => void;
}

export function UserRoleManager({ user, onUpdate }: UserRoleManagerProps) {
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { activeOrg, availableBranches } = useAppStore();

  const [newRoleData, setNewRoleData] = useState({
    roleId: "",
    scope: "org" as "org" | "branch",
    scopeId: activeOrg?.id || "",
  });

  // Load available roles
  useEffect(() => {
    const loadRoles = async () => {
      if (!activeOrg?.id) return;

      try {
        const roles = await fetchAvailableRoles(activeOrg.id);
        setAvailableRoles(roles);
      } catch (err) {
        console.error("Failed to load roles:", err);
      }
    };

    loadRoles();
  }, [activeOrg?.id]);

  const handleAddRole = async () => {
    if (!newRoleData.roleId || !newRoleData.scopeId) return;

    try {
      setIsLoading(true);
      setError(null);

      await assignUserRole(user.id, newRoleData.roleId, newRoleData.scope, newRoleData.scopeId);

      setSuccess("Role assigned successfully");
      setIsAddDialogOpen(false);
      setNewRoleData({
        roleId: "",
        scope: "org",
        scopeId: activeOrg?.id || "",
      });
      onUpdate();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign role");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRole = async (assignmentId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await removeUserRole(assignmentId);

      setSuccess("Role removed successfully");
      onUpdate();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove role");
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleIcon = (roleName: string) => {
    const icons = {
      org_owner: Crown,
      org_admin: Shield,
      branch_manager: Building2,
      branch_employee: Shield,
    };
    return icons[roleName as keyof typeof icons] || Shield;
  };

  const getRoleBadgeVariant = (roleName: string) => {
    const variants = {
      org_owner: "default",
      org_admin: "secondary",
      branch_manager: "outline",
      branch_employee: "outline",
    };
    return variants[roleName as keyof typeof variants] || "outline";
  };

  const getScopeBadgeVariant = (scope: string) => {
    return scope === "org" ? "default" : "secondary";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role Assignments ({user.roles?.length || 0})
              </CardTitle>
              <CardDescription>
                Manage user roles across organization and branch levels
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
                    Add Role
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Assign New Role</DialogTitle>
                    <DialogDescription>Add a new role assignment for this user</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={newRoleData.roleId}
                        onValueChange={(value) =>
                          setNewRoleData((prev) => ({ ...prev, roleId: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name} {role.is_basic && "(System)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scope">Scope</Label>
                      <Select
                        value={newRoleData.scope}
                        onValueChange={(value: "org" | "branch") => {
                          setNewRoleData((prev) => ({
                            ...prev,
                            scope: value,
                            scopeId: value === "org" ? activeOrg?.id || "" : "",
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="org">Organization</SelectItem>
                          <SelectItem value="branch">Branch</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {newRoleData.scope === "branch" && (
                      <div className="space-y-2">
                        <Label htmlFor="branch">Branch</Label>
                        <Select
                          value={newRoleData.scopeId}
                          onValueChange={(value) =>
                            setNewRoleData((prev) => ({ ...prev, scopeId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableBranches.map((branch) => (
                              <SelectItem key={branch.branch_id} value={branch.branch_id}>
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setIsAddDialogOpen(false)}
                        disabled={isLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddRole}
                        disabled={!newRoleData.roleId || !newRoleData.scopeId || isLoading}
                      >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Assign Role
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

          {!user.roles || user.roles.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Shield className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="mb-2 text-lg font-medium">No roles assigned</p>
              <p className="mb-4 text-sm">This user doesn't have any roles assigned yet.</p>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Assign First Role
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Scope Target</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {user.roles.map((roleAssignment) => {
                  const Icon = getRoleIcon(roleAssignment.role.name);

                  return (
                    <TableRow key={roleAssignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{roleAssignment.role.name}</div>
                            <Badge
                              variant={getRoleBadgeVariant(roleAssignment.role.name) as any}
                              className="text-xs"
                            >
                              {roleAssignment.role.is_basic ? "System" : "Custom"}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getScopeBadgeVariant(roleAssignment.scope) as any}>
                          {roleAssignment.scope === "org" ? "Organization" : "Branch"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{roleAssignment.scope_name || "Unknown"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {roleAssignment.scope === "org" ? "Organization-wide" : "Branch-specific"}
                        </span>
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
                              onClick={() => handleRemoveRole(roleAssignment.id)}
                              disabled={isLoading}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove Role
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
    </div>
  );
}
