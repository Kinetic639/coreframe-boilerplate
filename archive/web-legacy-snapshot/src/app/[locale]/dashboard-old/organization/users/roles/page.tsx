"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Users,
  Key,
  Crown,
  UserCheck,
  Briefcase,
  Package,
  Calculator,
  Loader2,
  AlertCircle,
  Copy,
  Eye,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  fetchOrganizationRoles,
  deleteRole,
  fetchPermissionsByCategory,
  type RoleWithPermissions,
  type PermissionsByCategory,
} from "@/app/actions/roles/role-management";
import { RoleCreateDialog } from "@/components/organization/roles/RoleCreateDialog";
import { RoleCloneDialog } from "@/components/organization/roles/RoleCloneDialog";

export default function RolesPage() {
  const t = useTranslations("organization.roleManagement");

  const [roles, setRoles] = React.useState<RoleWithPermissions[]>([]);
  const [allPermissions, setAllPermissions] = React.useState<PermissionsByCategory>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = React.useState<string | null>(null);
  const [roleToDelete, setRoleToDelete] = React.useState<RoleWithPermissions | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = React.useState(false);
  const [roleToClone, setRoleToClone] = React.useState<RoleWithPermissions | null>(null);

  const loadRoles = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [rolesData, permissionsData] = await Promise.all([
        fetchOrganizationRoles(),
        fetchPermissionsByCategory(),
      ]);

      setRoles(rolesData);
      setAllPermissions(permissionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roles");
      console.error("Error loading roles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleDeleteRole = async (role: RoleWithPermissions) => {
    if (role.assignedUsersCount && role.assignedUsersCount > 0) {
      return;
    }

    try {
      setDeleteLoading(role.id);
      const result = await deleteRole(role.id);

      if (result.success) {
        await loadRoles(); // Refresh data
        setRoleToDelete(null);
      } else {
        setError(result.error || "Failed to delete role");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleCreateComplete = () => {
    setCreateDialogOpen(false);
    loadRoles(); // Refresh data
  };

  const handleCloneComplete = () => {
    setCloneDialogOpen(false);
    setRoleToClone(null);
    loadRoles(); // Refresh data
  };

  const getRoleIcon = (roleName: string) => {
    const icons = {
      org_owner: Crown,
      org_admin: Shield,
      branch_manager: Briefcase,
      branch_admin: Briefcase,
      branch_employee: UserCheck,
      warehouse_manager: Package,
      employee: UserCheck,
      member: UserCheck,
      accountant: Calculator,
    };
    return icons[roleName as keyof typeof icons] || Shield;
  };

  const getRoleColor = (roleName: string) => {
    const colors = {
      org_owner: "text-purple-600",
      org_admin: "text-indigo-600",
      branch_manager: "text-blue-600",
      branch_admin: "text-blue-600",
      branch_employee: "text-gray-600",
      warehouse_manager: "text-green-600",
      employee: "text-gray-600",
      member: "text-gray-600",
      accountant: "text-orange-600",
    };
    return colors[roleName as keyof typeof colors] || "text-gray-600";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="mb-2 h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={loadRoles}>Try Again</Button>
      </div>
    );
  }

  const basicRoles = roles.filter((role) => role.is_basic);
  const customRoles = roles.filter((role) => !role.is_basic);
  const totalUsers = roles.reduce((sum, role) => sum + (role.assignedUsersCount || 0), 0);
  const totalPermissions = Object.values(allPermissions).reduce(
    (sum, perms) => sum + perms.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createRole")}
        </Button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid gap-4 md:grid-cols-4"
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-xs text-muted-foreground">
              {basicRoles.length} basic, {customRoles.length} custom
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">Active assignments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organization Owners</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roles.find((r) => r.name === "org_owner")?.assignedUsersCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Organization administrators</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permissions</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPermissions}</div>
            <p className="text-xs text-muted-foreground">Available permissions</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Roles Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Roles List ({roles.length})
            </CardTitle>
            <CardDescription>
              All roles defined in your organization with assigned user counts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => {
                  const Icon = getRoleIcon(role.name);
                  const colorClass = getRoleColor(role.name);

                  return (
                    <TableRow key={role.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-md bg-muted ${colorClass}`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-medium">{role.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {role.organization_id ? "Custom role" : "System role"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {role.description ? (
                            <p className="line-clamp-2 text-sm text-muted-foreground">
                              {role.description}
                            </p>
                          ) : (
                            <p className="text-sm italic text-muted-foreground">No description</p>
                          )}
                          <span
                            className={`mt-1 inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${role.is_basic ? "bg-gray-100 text-gray-800" : "bg-blue-100 text-blue-800"}`}
                          >
                            {role.is_basic ? "System" : "Custom"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{role.assignedUsersCount || 0}</span>
                          {role.assignedUsersCount && role.assignedUsersCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Active
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{role.permissions?.length || 0} assigned</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link
                                href={{
                                  pathname: "/dashboard-old/organization/roles/[id]",
                                  params: { id: role.id },
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                {t("roleDetails")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRoleToClone(role);
                                setCloneDialogOpen(true);
                              }}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              {t("cloneRole")}
                            </DropdownMenuItem>
                            {!role.is_basic && (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={{
                                      pathname: "/dashboard-old/organization/roles/[id]",
                                      params: { id: role.id },
                                    }}
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    {t("editRole")}
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  disabled={Boolean(
                                    role.assignedUsersCount && role.assignedUsersCount > 0
                                  )}
                                  onClick={() => setRoleToDelete(role)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t("deleteRole")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Role Dialog */}
      {createDialogOpen && (
        <RoleCreateDialog
          allPermissions={allPermissions}
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onComplete={handleCreateComplete}
        />
      )}

      {/* Clone Role Dialog */}
      {cloneDialogOpen && roleToClone && (
        <RoleCloneDialog
          sourceRole={roleToClone}
          open={cloneDialogOpen}
          onOpenChange={setCloneDialogOpen}
          onComplete={handleCloneComplete}
        />
      )}

      {/* Delete Role Dialog */}
      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteWarning")} This will permanently delete the role "{roleToDelete?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => roleToDelete && handleDeleteRole(roleToDelete)}
              disabled={deleteLoading === roleToDelete?.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading === roleToDelete?.id && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("deleteRole")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
